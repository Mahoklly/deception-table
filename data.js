// The Deception Table — content data.
// Each card: secret word, imposter hint, crew clue pools by tier, imposter bluff pool.
// weights: obvious=3 (proves innocence, leaks secret), medium=2, subtle=1 (safe, suspicious).
// Imposter bluff words are ordered vague -> confident.
export const DECK = [
  { secret:"Doctor", hint:"Hospital",
    obvious:["stethoscope","diagnosis","prescription","surgeon"],
    medium:["patient","clinic","white coat","checkup","fever"],
    subtle:["appointment","waiting room","trust","hands","charts"],
    bluff:["nurse","emergency","bed","corridor","ambulance","medicine","pain","recovery","visitor","night shift"] },
  { secret:"Pirate", hint:"Ocean",
    obvious:["parrot","eyepatch","plunder","cutlass"],
    medium:["treasure","ship","captain","island","rum"],
    subtle:["map","horizon","crew","freedom","storm"],
    bluff:["waves","salt","deep","sailing","fish","harbor","wind","tide","blue","voyage"] },
  { secret:"Wedding", hint:"Party",
    obvious:["bride","vows","groom","bouquet"],
    medium:["ring","cake","dress","aisle","toast"],
    subtle:["family","promise","tears","photos","dance"],
    bluff:["music","guests","celebration","invitation","gift","dancing","food","speech","night","balloons"] },
  { secret:"Vampire", hint:"Night",
    obvious:["fangs","coffin","garlic","bloodsucker"],
    medium:["blood","bat","castle","immortal","pale"],
    subtle:["mirror","invitation","thirst","old","cape"],
    bluff:["dark","moon","sleep","shadow","cold","stars","silence","fear","dream","black"] },
  { secret:"Library", hint:"Quiet",
    obvious:["bookshelf","librarian","borrow","catalog"],
    medium:["books","reading","silence","study","pages"],
    subtle:["whisper","dust","late fee","corner","lamp"],
    bluff:["peace","calm","room","chair","thinking","alone","focus","evening","soft","still"] },
  { secret:"Circus", hint:"Show",
    obvious:["clown","trapeze","ringmaster","juggler"],
    medium:["tent","acrobat","lion","tickets","popcorn"],
    subtle:["travel","applause","danger","sawdust","caravan"],
    bluff:["stage","audience","lights","performance","music","laughter","costume","crowd","act","curtain"] },
  { secret:"Winter", hint:"Cold",
    obvious:["snowman","blizzard","icicle","frostbite"],
    medium:["snow","ice","scarf","fireplace","sled"],
    subtle:["silence","white","breath","early dark","boots"],
    bluff:["freezing","wind","jacket","shiver","grey","hot tea","gloves","numb","weather","indoors"] },
  { secret:"Prison", hint:"Locked",
    obvious:["inmate","warden","cellblock","parole"],
    medium:["bars","escape","guard","sentence","yard"],
    subtle:["time","walls","routine","letters","numbers"],
    bluff:["key","door","chain","waiting","inside","gate","heavy","steel","alone","years"] },
  { secret:"Desert", hint:"Hot",
    obvious:["cactus","camel","oasis","dune"],
    medium:["sand","sun","thirst","mirage","nomad"],
    subtle:["empty","gold","wind","stars","distance"],
    bluff:["burning","dry","summer","sweat","shade","water","yellow","endless","heatwave","noon"] },
  { secret:"Detective", hint:"Crime",
    obvious:["magnifying glass","sleuth","deduction","trench coat"],
    medium:["clues","mystery","suspect","case","alibi"],
    subtle:["questions","notebook","rain","instinct","shadows"],
    bluff:["police","thief","victim","weapon","scene","witness","night","danger","secret","motive"] },
  { secret:"Bakery", hint:"Morning",
    obvious:["croissant","baker","sourdough","oven mitts"],
    medium:["bread","oven","flour","pastry","dough"],
    subtle:["warm","smell","early","queue","corner shop"],
    bluff:["coffee","breakfast","fresh","sunrise","routine","sweet","paper bag","street","open","first light"] },
  { secret:"Volcano", hint:"Mountain",
    obvious:["lava","eruption","magma","crater"],
    medium:["ash","smoke","island","heat","rumble"],
    subtle:["sleeping","red","pressure","warning","ancient"],
    bluff:["peak","climb","rocks","high","clouds","steep","view","stone","summit","trail"] },
];

// NPC roster — 3 opponents with distinct read/tell behaviour.
// aggression: how quickly suspicion turns into accusation glances & votes
// caution: bias toward subtle words when crew (higher = more subtle = riskier look)
// tell: chance per round the imposter version visibly hesitates (player-readable)
export const NPCS = [
  { id:"brute", name:"Gruff Halloran", chip:"#b98a4f", aggression:0.8, caution:0.25, tell:0.25,
    thinkMs:[900,1700] },
  { id:"widow", name:"Madame Vey",     chip:"#9c6b7c", aggression:0.35, caution:0.75, tell:0.12,
    thinkMs:[1600,2600] },
  { id:"fox",  name:"Silky Marlowe",   chip:"#8fa06b", aggression:0.55, caution:0.5,  tell:0.4,
    thinkMs:[700,1400] },
];

export const RULES = {
  seats: 4,
  maxRounds: 4,          // forced vote after this many word rounds
  voteUnlockRound: 2,    // player may call an early vote from this round
  handSize: 4,
  weights: { obvious:3, medium:2, subtle:1 },
};
