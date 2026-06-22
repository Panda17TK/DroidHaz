export const WEAPONS = {
  pistol : { id:'pistol',  name:'Pistol',  dmg:28, pellets:1, mag:6,  magSize:6,  spread:0.04, fireRate:0.22, ammoType:'ammo9' },
  shotgun: { id:'shotgun', name:'Shotgun', dmg:18, pellets:6, mag:2,  magSize:2,  spread:0.25, fireRate:0.6,  ammoType:'ammo12'},
  beam   : { id:'beam',    name:'Beam Rifle', dmg:90, pellets:1, mag:Infinity, magSize:Infinity, spread:0, fireRate:2.0, ammoType:'ammoBeam' },
  mg     : { id:'mg',      name:'Machine Gun', dmg:12, pellets:1, mag:40, magSize:40, spread:0.18, fireRate:0.08, ammoType:'ammo9' },
  grenade: { id:'grenade', name:'Grenade', dmg:120, pellets:1, mag:1,  magSize:1,  spread:0, fireRate:0.9, ammoType:'ammoNade' },
};
export const SPAWN = { baseInterval:7, capBase:8, maxCap:24 };
export const ITEM_TYPES = ['key','ammo9','ammo12','ammoBeam','ammoNade','med','buffRange','buffMelee','buffSpeed','crate'];
