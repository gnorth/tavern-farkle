export const opponents=[
 {id:'innkeeper',portrait:'/portraits/innkeeper-redesign.jpg',name:'Корчмарка',level:'Середній',character:'Виважена',description:'Збирає комбінації й зупиняється, коли ризик зростає.'},
 {id:'apprentice',portrait:'/portraits/apprentice-redesign.jpg',name:'Учень',level:'Легкий',character:'Обережний',description:'Рано забирає очки й рідко наважується на великий виграш.'},
 {id:'mercenary',portrait:'/portraits/mercenary-redesign.jpg',name:'Найманець',level:'Складний',character:'Азартний',description:'Грає великими ставками та частіше ризикує заради довгого ходу.'},
 {id:'merchant',portrait:'/portraits/merchant-redesign.jpg',name:'Купчиня',level:'Експерт',character:'Розважлива',description:'Порівнює комбінації, оцінює ризик і враховує рахунок суперника.'},
] as const;
export type OpponentId=typeof opponents[number]['id'];
export const opponentInfo=(id:OpponentId)=>opponents.find(o=>o.id===id)!;
