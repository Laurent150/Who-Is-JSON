(function(root){
 const fields=['title','plain','naming','result','pitfall'];
 const extra={
 'py.json-read':{walkthrough:['text holds JSON-formatted text, not yet a dictionary whose fields you can read.','json.loads(text) reads that text into a dictionary containing count and stores it as data.','data["count"] retrieves 2, which is stored as answer.']},
 'py.annotation':{walkthrough:['n: int describes the expected input type; -> int describes the expected result type. Neither converts values.','double(3) supplies 3 as n; n * 2 produces 6.','return supplies 6 to the caller, where answer receives it.']},
 'py.assign':{walkthrough:['score = 10 associates score with 10.','The next line evaluates the right side first: 10 + 5 produces 15.','The assignment then makes score refer to 15.']},
 'py.function':{walkthrough:['Define greet with a parameter named name. No greeting has been created yet.','Calling greet("小林") supplies “小林” as name.','return supplies the assembled “你好，小林” to the caller, which stores it as message.']},
 'py.super':{
 prerequisites:[{name:'What is inheritance?',text:'User(Base) lets User reuse functionality defined by Base. Here Base stores the name and User adds an active flag.'},{name:'Which object is self?',text:'self refers to the object being initialized. In both methods here, it is the same newly created User object.'}],
 walkthrough:['Define Base and User. These definitions describe initialization; user does not exist yet.','user = User("小林") starts creating a User object and supplies name="小林" to its initializer.','Here super().__init__(name) finds Base’s initializer. self.name = name stores the name on that same object.','Back in User’s initializer, self.active = True stores the active flag. After initialization, user refers to the prepared object.'],
 transfer:'In your source, find the data passed to the initializer and the inherited implementation. Check that implementation; do not assume it uses this example’s fields.',
 exercise:'If super().__init__(name) is removed from this example, active is still set to True, but no remaining step sets name. Reading user.name would raise an attribute error.'}
 };
 function localize(card){
  const en=root.WhoEnglishCards?.[card.id];
  if(root.WhoI18n?.locale!=='en'||card.origin==='ai'||!en)return card;
  return {...card,...Object.fromEntries(fields.map((key,i)=>[key,en[i]])),...extra[card.id]};
 }
 root.WhoLocalizeCard=localize;
})(globalThis);
