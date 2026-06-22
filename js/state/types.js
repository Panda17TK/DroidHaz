/**
 * @typedef {{x:number,y:number,w:number,h:number}} AABB
 * @typedef {{range:number,dmg:number,speed:number,tRange:number,tDmg:number,tSpeed:number}} Buffs
 * @typedef {{id:string,name:string,dmg:number,pellets?:number,mag:number,magSize:number,spread:number,fireRate:number,ammoType:string}} Weapon
 * @typedef {{x:number,y:number,w:number,h:number, baseSpeed:number, hp:number, iTime:number, vx:number, vy:number, facing:{x:number,y:number}, meleeCD:number, shootCD:number, buffs:Buffs, staMax:number, sta:number, inv:Object, weapons:Weapon[], curW:number, isDashing?:boolean}} Player
 * @typedef {{kind:'zombie'|'spitter',x:number,y:number,w:number,h:number,hp:number,maxhp:number,baseSpeed:number,shootCD:number,vx:number,vy:number,meleeCD:number,bumpCD:number}} Mob
 * @typedef {{map:string[][], tileHP:number[][], tileMaxHP:number[][]}} MapLayer
 * @typedef {{player:Player, mobs:Mob[], items:any[], fx:any[], bullets:any[], ebullets:any[], grenades:any[], slashes:any[], flow:number[][], timers:Object, shake:{t:number,mag:number}, paused:boolean} State
 */