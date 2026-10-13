// Local self-signed TLS fixture. Never changes the host trust store.
const fs=require('node:fs'),https=require('node:https'),http=require('node:http');
const [port,target,key,cert]=process.argv.slice(2);
https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(req,res)=>{
 const upstream=http.request(target+req.url,{method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
 upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream);
}).listen(Number(port),'127.0.0.1');
