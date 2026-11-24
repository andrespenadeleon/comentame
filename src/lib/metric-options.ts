export const metricOptions=[
 {id:'visits',label:'Visitas',group:'Indicadores'},
 {id:'starts',label:'Encuestas iniciadas',group:'Indicadores'},
 {id:'completions',label:'Encuestas completadas',group:'Indicadores'},
 {id:'unfinished',label:'Iniciadas sin envío',group:'Indicadores'},
 {id:'time',label:'Tiempo activo promedio',group:'Indicadores'},
 {id:'average',label:'Calificación promedio',group:'Indicadores'},
 {id:'conversion',label:'Visitas con opinión',group:'Indicadores'},
 {id:'google',label:'Clics a Google',group:'Indicadores',admin:true},
 {id:'daily',label:'Encuestas contestadas en 30 días',group:'Gráficas'},
 {id:'weekday',label:'Respuestas por día de la semana',group:'Gráficas'},
 {id:'questions',label:'Participación por pregunta',group:'Gráficas'},
] as const;
export type MetricId=typeof metricOptions[number]['id'];
