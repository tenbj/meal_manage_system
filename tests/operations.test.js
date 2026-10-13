const {test}=require('node:test'),assert=require('node:assert/strict');
const {operations}=require('../src/operation-catalog'),D=require('../public/assets/merchant-domain');
test('public completion rejects unknown, duplicate and mixed invalid IDs without changes',()=>{
 for(const ids of [['missing'],['valid','missing'],['valid','valid']]){const state=D.initial();state.boxes=[{id:'valid',status:'pending',items:[]}];const before=JSON.stringify(state);assert.throws(()=>operations.finish_boxes.apply(state,{box_ids:ids}));assert.equal(JSON.stringify(state),before);}
});
test('write contracts reject unproved nutrition, missing evidence and invalid dates',()=>{
 const base={request_id:'12345678',expected_version:1,evidence:'source'};
 assert.equal(operations.create_customer.schema.safeParse({...base,name:'客户',evidence:''}).success,false);
 assert.equal(operations.create_dish.schema.safeParse({...base,name:'饭',category:'主食',kcal100:100,ingredients:[],reference:''}).success,false);
 assert.equal(operations.set_menu.schema.safeParse({...base,date:'2026-02-30',meal:'lunch',items:[{dishId:'a',grams:100}]}).success,false);
});
test('public cancel and resume reject nonexistent objects',()=>{for(const name of ['cancel_box','resume_box'])assert.throws(()=>operations[name].apply(D.initial(),{box_id:'missing',charge:false,reason:'test'}));});
