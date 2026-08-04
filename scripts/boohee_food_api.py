from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib import error, parse, request

import pandas as pd


DEFAULT_BASE_URL = "https://api.boohee.com/open-apis"


class BooheeApiError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        api_code: int | None = None,
        endpoint: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        self.api_code = api_code
        self.endpoint = endpoint
        self.payload = payload
        super().__init__(message)


def _require_api_key(api_key: str | None) -> str:
    resolved = api_key or os.getenv("BOOHEE_API_KEY")
    if not resolved:
        raise ValueError("Missing API key. Pass api_key or set BOOHEE_API_KEY.")
    return resolved


def _to_query_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


@dataclass
class BooheeFoodClient:
    api_key: str | None = None
    base_url: str = DEFAULT_BASE_URL
    timeout: int = 30

    def __post_init__(self) -> None:
        self.api_key = _require_api_key(self.api_key)

    def _get(self, endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
        clean_params = {
            key: _to_query_value(value)
            for key, value in params.items()
            if value is not None
        }
        url = (
            self.base_url.rstrip("/")
            + endpoint
            + "?"
            + parse.urlencode(clean_params)
        )
        req = request.Request(
            url,
            headers={
                "Accept": "*/*",
                "X-Api-Key": str(self.api_key),
                "User-Agent": "boohee-food-api-python/1.0",
            },
            method="GET",
        )

        try:
            with request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8", errors="replace")
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise BooheeApiError(
                f"HTTP request failed: status={exc.code}, body={body[:500]}",
                endpoint=endpoint,
            ) from exc
        except error.URLError as exc:
            raise BooheeApiError(
                f"HTTP request failed: {exc.reason}",
                endpoint=endpoint,
            ) from exc

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise BooheeApiError(
                f"Response is not valid JSON: {body[:500]}",
                endpoint=endpoint,
            ) from exc

        api_code = payload.get("code")
        if api_code != 0:
            message = payload.get("message", "")
            raise BooheeApiError(
                f"Boohee API business error: api_code={api_code}, message={message}",
                api_code=api_code,
                endpoint=endpoint,
                payload=payload,
            )

        return payload

    def search_food(
        self,
        *,
        keyword: str | None = None,
        barcode: str | None = None,
        page: int = 1,
        per_page: int = 20,
        sort: str | None = None,
        with_units: bool = False,
    ) -> dict[str, Any]:
        if not keyword and not barcode:
            raise ValueError("keyword and barcode cannot both be empty.")
        return self._get(
            "/v1/food/search",
            {
                "keyword": keyword,
                "barcode": barcode,
                "page": page,
                "per_page": per_page,
                "sort": sort,
                "with_units": with_units,
            },
        )

    def search_food_df(
        self,
        *,
        keyword: str | None = None,
        barcode: str | None = None,
        page: int = 1,
        per_page: int = 20,
        sort: str | None = None,
        with_units: bool = False,
    ) -> pd.DataFrame:
        payload = self.search_food(
            keyword=keyword,
            barcode=barcode,
            page=page,
            per_page=per_page,
            sort=sort,
            with_units=with_units,
        )
        foods = payload.get("data", {}).get("foods", [])
        return pd.json_normalize(foods, sep="_")

    def get_food_detail(
        self,
        *,
        code: str,
        with_ingredients: bool = True,
        with_units: bool = True,
        with_materials: bool = True,
    ) -> dict[str, Any]:
        return self._get(
            "/v1/food/detail",
            {
                "code": code,
                "with_ingredients": with_ingredients,
                "with_units": with_units,
                "with_materials": with_materials,
            },
        )

    def get_food_detail_df(
        self,
        *,
        code: str | None = None,
        keyword: str | None = None,
        barcode: str | None = None,
        pick: int = 1,
        with_ingredients: bool = True,
        with_units: bool = True,
        with_materials: bool = True,
    ) -> pd.DataFrame:
        food_code = code

        if not food_code:
            search_df = self.search_food_df(
                keyword=keyword,
                barcode=barcode,
                page=1,
                per_page=max(1, pick),
                with_units=False,
            )
            if search_df.empty:
                target = keyword or barcode
                raise BooheeApiError(f"No food found for: {target}")
            if pick < 1 or pick > len(search_df):
                raise ValueError(f"pick must be between 1 and {len(search_df)}.")
            food_code = str(search_df.iloc[pick - 1]["code"])

        payload = self.get_food_detail(
            code=str(food_code),
            with_ingredients=with_ingredients,
            with_units=with_units,
            with_materials=with_materials,
        )
        data = payload.get("data") or {}
        df = pd.json_normalize(data, sep="_")
        return df


def get_food_detail_df(
    *,
    api_key: str | None = None,
    code: str | None = None,
    keyword: str | None = None,
    barcode: str | None = None,
    pick: int = 1,
    with_ingredients: bool = True,
    with_units: bool = True,
    with_materials: bool = True,
    base_url: str = DEFAULT_BASE_URL,
) -> pd.DataFrame:
    client = BooheeFoodClient(api_key=api_key, base_url=base_url)
    return client.get_food_detail_df(
        code=code,
        keyword=keyword,
        barcode=barcode,
        pick=pick,
        with_ingredients=with_ingredients,
        with_units=with_units,
        with_materials=with_materials,
    )
