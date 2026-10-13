const {z}=require('zod');
const D=require('../public/assets/merchant-domain');
const crypto=require('node:crypto');
const id=()=>crypto.randomUUID();
const text=z.string().trim().min(1).max(120);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===v;});
const meal=z.enum(['lunch','dinner']);
const items=z.array(z.object({dishId:text,grams:z.number().positive().max(10000)}).strict()).min(1).max(30);
const common={request_id:z.string().min(8).max(100),expected_version:z.number().int().positive(),evidence:z.string().trim().min(1).max(1000)};
const define=(path,title,shape,apply)=>({path,title,schema:z.object({...common,...shape}).strict(),apply});
const operations={
 create_customer:define('/customers','新增客户',{name:text,phone:z.string().max(40).default(''),address:z.string().max(1000).default(''),fulfillment:z.enum(['delivery','pickup']).default('delivery')},(s,p)=>{const row={id:id(),name:p.name,phone:p.phone,address:p.address,fulfillment:p.fulfillment,restrictions:[],dislikes:[],allergies:[],createdAt:new Date().toISOString()};s.customers.push(row);return row;}),
 create_order:define('/orders','登记购买餐次',{customer_id:text,start_date:date,end_date:date,credits:z.number().int().min(1).max(10000),price:z.number().nonnegative().default(0)},(s,p)=>{const row={id:id(),customerId:p.customer_id,startDate:p.start_date,endDate:p.end_date,credits:p.credits,price:p.price,kind:'plan',serviceType:'包餐',meals:['lunch','dinner'],weekdays:[0,1,2,3,4,5,6],portions:1,status:'服务中',paidStatus:'未记录',createdAt:new Date().toISOString()};s.orders.push(row);return row;}),
 create_dish:define('/dishes','新增有依据的菜品',{name:text,category:z.enum(['荤','素','主食','海鲜']),kcal100:z.number().positive().max(1000),ingredients:z.array(text).max(60),reference:z.string().trim().min(1).max(1000)},(s,p)=>{const row={id:id(),name:p.name,category:p.category,defaultGrams:150,ingredients:p.ingredients,ingredientsSource:'merchant',nutrition:{source:'manual',basis:'cooked',kcal100:p.kcal100,reference:p.reference}};s.dishes.push(row);return row;}),
 set_menu:define('/menus','设置本餐菜单',{date,meal,items},(s,p)=>{D.setMenu(s,p.date,p.meal,p.items);return s.menus[p.date+':'+p.meal];}),
 confirm_menu:define('/menus/confirm','确认菜单',{date,meal},(s,p)=>{D.confirmMenu(s,p.date,p.meal);return D.workflow(s,p.date,p.meal);}),
 add_diner:define('/diners','安排用餐人',{customer_id:text,date,meal},(s,p)=>D.addDiner(s,p.customer_id,p.date,p.meal,id)),
 confirm_roster:define('/diners/confirm','确认用餐与标签条件',{date,meal},(s,p)=>{D.confirmRoster(s,p.date,p.meal);return D.workflow(s,p.date,p.meal);}),
 finish_boxes:define('/boxes/finish','完成出餐并扣餐',{box_ids:z.array(text).min(1).max(100)},(s,p)=>{if(new Set(p.box_ids).size!==p.box_ids.length||p.box_ids.some(id=>!s.boxes.some(b=>b.id===id&&b.status==='pending')))throw new Error('所有餐盒必须存在且待出餐，不能混入重复、已完成或不存在的记录');D.finish(s,p.box_ids);return s.boxes.filter(b=>p.box_ids.includes(b.id));}),
 cancel_box:define('/boxes/cancel','取消用餐并记录原因',{box_id:text,charge:z.boolean(),reason:text},(s,p)=>{D.cancelBox(s,p.box_id,p.charge,p.reason);return s.boxes.find(b=>b.id===p.box_id);}),
 resume_box:define('/boxes/resume','恢复已取消或暂停的用餐',{box_id:text},(s,p)=>{D.resumeBox(s,p.box_id);return s.boxes.find(b=>b.id===p.box_id);}),
 adjust_credits:define('/credits','追加餐次调整流水',{order_id:text,balance:z.number().int().nonnegative().max(10000),reason:text},(s,p)=>{D.adjustBalance(s,p.order_id,p.balance,p.reason,id());return s.creditAdjustments.at(-1);})
};
module.exports={operations};
