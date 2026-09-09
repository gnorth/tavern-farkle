export const opponents=[
 {id:'innkeeper',portrait:'/portraits/innkeeper.jpg',name:'Корчмар',level:'Середній',character:'Виважений',description:'Збирає комбінації й зупиняється, коли ризик зростає.'},
 {id:'apprentice',portrait:'/portraits/apprentice.jpg',name:'Учень',level:'Легкий',character:'Обережний',description:'Рано забирає очки й рідко наважується на великий виграш.'},
 {id:'mercenary',portrait:'/portraits/mercenary.jpg',name:'Найманець',level:'Складний',character:'Азартний',description:'Грає великими ставками та частіше ризикує заради довгого ходу.'},
 {id:'merchant',portrait:'/portraits/merchant.jpg',name:'Купчиня',level:'Експерт',character:'Розважлива',description:'Порівнює комбінації, оцінює ризик і враховує рахунок суперника.'},
] as const;
export type OpponentId=typeof opponents[number]['id'];
export const opponentInfo=(id:OpponentId)=>opponents.find(o=>o.id===id)!;
