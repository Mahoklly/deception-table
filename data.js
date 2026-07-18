// The Deception Table — content data.
// DECK is keyed by language ("en" / "ku"); each language array is drawn
// from independently at match start (see newMatch() in game.js), so the
// two decks don't need to be identical length or index-aligned — they're
// kept in the same secret order here only for maintainability.
const DECK_EN = [
  // ---- ORIGINAL 12 (expanded) ----
  { secret: "Knight", hint: "Castle",
    obvious: ["sword", "armor", "shield", "lance", "horse", "tournament", "king", "queen", "battle", "charge"],
    medium: ["honor", "loyalty", "duty", "squire", "training", "war", "enemy", "capture", "tower", "flag"],
    subtle: ["siege", "crown", "fortress", "brave", "steed", "duel", "guard", "oath", "chivalry", "joust"],
    bluff: ["knight", "castle", "battle", "armor", "shield", "sword", "king", "queen", "horse", "war"] },

  { secret: "Witch", hint: "Cauldron",
    obvious: ["broomstick", "potion", "spellbook", "crystal", "brew", "candle", "incantation", "familiar", "herbs", "moon"],
    medium: ["circle", "omen", "magic", "curse", "dark", "flight", "forest", "raven", "cloak", "mirror"],
    subtle: ["whisper", "shadow", "spirit", "mystic", "coven", "enchant", "fog", "star", "cauldron", "night"],
    bluff: ["witch", "magic", "spell", "potion", "cauldron", "crystal", "moon", "forest", "dark", "raven"] },

  { secret: "Ghost", hint: "Spirit",
    obvious: ["apparition", "phantom", "ectoplasm", "medium", "haunted", "whisper", "shadow", "cold", "chain", "fear"],
    medium: ["footsteps", "memory", "chill", "unfinished", "flicker", "dead", "scream", "darkness", "creak", "old"],
    subtle: ["ominous", "terror", "void", "tomb", "spirit", "glimpse", "supernatural", "haunting", "echo", "soul"],
    bluff: ["ghost", "haunted", "spirit", "phantom", "darkness", "fear", "scream", "old", "shadow", "whisper"] },

  { secret: "Casino", hint: "Risky",
    obvious: ["roulette", "jackpot", "poker", "blackjack", "chips", "dice", "cards", "bet", "high", "dealer"],
    medium: ["luck", "bluff", "tension", "system", "tell", "risk", "winner", "loser", "money", "game"],
    subtle: ["turn", "watch", "silence", "pressure", "strategy", "gamble", "odds", "cheat", "felt", "casino"],
    bluff: ["casino", "poker", "roulette", "dice", "chips", "bet", "luck", "dealer", "winner", "money"] },

  { secret: "Theater", hint: "Stage",
    obvious: ["spotlight", "curtain", "monologue", "applause", "script", "costume", "backstage", "rehearsal", "makeup", "actor"],
    medium: ["emotion", "timing", "breath", "mask", "improvisation", "acting", "stage", "role", "scene", "exit"],
    subtle: ["perform", "crowd", "lights", "voice", "mirror", "drama", "audience", "character", "dialogue", "play"],
    bluff: ["theater", "stage", "actor", "script", "curtain", "applause", "performance", "lights", "role", "play"] },

  { secret: "Castle", hint: "Kingdom",
    obvious: ["king", "queen", "throne", "armor", "crown", "knight", "moat", "drawbridge", "tower", "kingdom"],
    medium: ["royal", "court", "siege", "banner", "stone", "hall", "guard", "jester", "feast", "war"],
    subtle: ["power", "history", "ancient", "heritage", "keep", "fortress", "noble", "passage", "heir", "castle"],
    bluff: ["castle", "king", "queen", "knight", "crown", "throne", "armor", "moat", "royal", "tower"] },

  { secret: "Inn", hint: "Tavern",
    obvious: ["ale", "hearth", "keep", "innkeeper", "rooms", "common", "cellar", "kitchen", "guest", "tavern"],
    medium: ["warm", "gathering", "traveler", "hospitality", "fire", "bench", "lodging", "country", "old", "inn"],
    subtle: ["comfort", "quiet", "escape", "village", "roof", "night", "story", "cozy", "roaring", "inn"],
    bluff: ["inn", "tavern", "ale", "hearth", "guest", "fire", "warm", "rooms", "keeper", "traveler"] },

  { secret: "Alchemist", hint: "Lab",
    obvious: ["potion", "elixir", "crystal", "vial", "brew", "distill", "fire", "glass", "alchemy", "workbench"],
    medium: ["flask", "powder", "charcoal", "simmer", "reagent", "mystic", "shelf", "study", "wisdom", "alchemist"],
    subtle: ["recipe", "balance", "translucent", "apprentice", "phial", "catalyst", "formation", "change", "metal", "alchemist"],
    bluff: ["alchemist", "potion", "elixir", "crystal", "vial", "brew", "fire", "glass", "lab", "workbench"] },

  { secret: "Tavern", hint: "Drinks",
    obvious: ["bar", "mug", "ale", "barkeep", "stool", "cask", "tankard", "tap", "cellar", "tavern"],
    medium: ["warm", "fire", "laughter", "song", "dice", "cards", "gossip", "patron", "keep", "tavern"],
    subtle: ["company", "glow", "vintage", "counter", "quiet", "bottle", "journey", "tale", "mug", "tavern"],
    bluff: ["tavern", "bar", "ale", "mug", "barkeep", "fire", "cask", "song", "cards", "patron"] },

  { secret: "Dungeon", hint: "Dark",
    obvious: ["chains", "cell", "torture", "prisoner", "warden", "darkness", "rat", "rack", "dungeon", "iron"],
    medium: ["damp", "stone", "guard", "escape", "solitude", "oubliette", "tunnel", "grate", "dungeon", "prison"],
    subtle: ["silence", "echo", "cobweb", "hopeless", "lightless", "corridor", "forgotten", "moan", "rut", "dungeon"],
    bluff: ["dungeon", "prison", "cell", "chains", "warden", "rat", "darkness", "stone", "guard", "escape"] },

  { secret: "Mansion", hint: "Old",
    obvious: ["ballroom", "chandelier", "spiral", "parlor", "butler", "foyer", "study", "crystal", "portrait", "mansion"],
    medium: ["estate", "tapestry", "antique", "library", "silver", "hedge", "garden", "grand", "elegance", "mansion"],
    subtle: ["dust", "secret", "echo", "shadow", "abandoned", "creaking", "attic", "vaulted", "wealth", "mansion"],
    bluff: ["mansion", "old", "estate", "ballroom", "chandelier", "butler", "study", "portrait", "garden", "grand"] },

  { secret: "Cathedral", hint: "Holy",
    obvious: ["stained", "organ", "confession", "pew", "bell", "apse", "altar", "lectern", "incense", "hymn"],
    medium: ["stone", "vault", "sacred", "chant", "gothic", "kneel", "roses", "homily", "reverent", "cathedral"],
    subtle: ["quiet", "glimmer", "transept", "glory", "light", "worship", "sanctuary", "tower", "cathedral", "holy"],
    bluff: ["cathedral", "church", "stained", "organ", "bell", "altar", "pew", "stone", "holy", "chant"] },

  { secret: "Library", hint: "Books",
    obvious: ["shelf", "tome", "book", "librarian", "catalog", "lamp", "read", "archive", "dust", "card"],
    medium: ["study", "globe", "silence", "wealth", "knowledge", "page", "letter", "history", "bibliophile", "library"],
    subtle: ["quiet", "learning", "old", "binding", "ink", "paper", "character", "classic", "wisdom", "library"],
    bluff: ["library", "books", "shelf", "read", "tome", "librarian", "catalog", "lamp", "study", "knowledge"] },

  { secret: "Forge", hint: "Fire",
    obvious: ["forge", "anvil", "hammer", "bellows", "iron", "spark", "blade", "tongs", "metal", "fire"],
    medium: ["glow", "smoke", "strike", "ring", "smithy", "weapon", "armor", "heat", "forge", "work"],
    subtle: ["hiss", "soot", "rhythm", "ingot", "craft", "ore", "clank", "skill", "forge", "anvil"],
    bluff: ["forge", "fire", "anvil", "hammer", "iron", "blade", "smithy", "heat", "spark", "weapon"] },

  { secret: "Tomb", hint: "Burial",
    obvious: ["sarcophagus", "pyramid", "pharaoh", "hieroglyph", "canopic", "stone", "chamber", "mask", "amulet", "tomb"],
    medium: ["crypt", "symbol", "treasure", "mummy", "cracked", "shaft", "guard", "soul", "priest", "tomb"],
    subtle: ["eternal", "darkness", "rest", "echo", "preserved", "sphinx", "sand", "gate", "oasis", "tomb"],
    bluff: ["tomb", "burial", "pyramid", "pharaoh", "sarcophagus", "hieroglyph", "mummy", "crypt", "stone", "mask"] },

  { secret: "Shrine", hint: "Sacred",
    obvious: ["shrine", "torii", "stone", "offering", "oracle", "lantern", "bowing", "monk", "incense", "shrine"],
    medium: ["peace", "prayer", "rope", "whisper", "guardian", "sacred", "climb", "wood", "gate", "shrine"],
    subtle: ["solemn", "light", "stillness", "vow", "bloom", "footsteps", "chime", "spirit", "threshold", "shrine"],
    bluff: ["shrine", "sacred", "stone", "offering", "torii", "lantern", "prayer", "monk", "incense", "peace"] },

  { secret: "Crypt", hint: "Dungeon",
    obvious: ["crypt", "coffin", "bone", "skeleton", "altar", "torch", "dust", "cobweb", "tombstone", "skull"],
    medium: ["shroud", "chamber", "candle", "dark", "echo", "vault", "stone", "stalactite", "sarcophagus", "crypt"],
    subtle: ["silence", "ancient", "forgotten", "cold", "prayer", "wraith", "gloom", "memory", "sanctum", "crypt"],
    bluff: ["crypt", "dungeon", "coffin", "bone", "skeleton", "altar", "dust", "candle", "tombstone", "skull"] },

  { secret: "Siege", hint: "War",
    obvious: ["catapult", "battering", "wall", "battle", "trebuchet", "arrow", "tower", "barricade", "assault", "siege"],
    medium: ["camp", "flag", "castle", "encircle", "banner", "breach", "stone", "morale", "engine", "siege"],
    subtle: ["standoff", "tension", "dust", "supply", "horn", "relief", "armor", "assault", "siege", "war"],
    bluff: ["siege", "war", "catapult", "castle", "battle", "arrow", "tower", "wall", "camp", "flag"] },

  { secret: "Parchment", hint: "Scroll",
    obvious: ["parchment", "quill", "ink", "scroll", "seal", "manuscript", "vellum", "letter", "cursive", "parchment"],
    medium: ["paper", "document", "history", "library", "artifact", "signature", "scrivener", "book", "parchment", "ancient"],
    subtle: ["fragile", "yellowed", "hand", "record", "copperplate", "calf", "epistle", "archive", "parchment", "old"],
    bluff: ["parchment", "scroll", "quill", "ink", "letter", "seal", "manuscript", "vellum", "document", "old"] },

  { secret: "Observatory", hint: "Sky",
    obvious: ["telescope", "dome", "planet", "star", "astronomer", "orbit", "nebula", "chart", "cupola", "observatory"],
    medium: ["night", "constellation", "instrument", "silver", "focus", "mirror", "moon", "solar", "scope", "observatory"],
    subtle: ["heavens", "isolation", "light", "awe", "dark", "gear", "roof", "science", "cosmos", "observatory"],
    bluff: ["observatory", "telescope", "stars", "planet", "dome", "astronomer", "orbit", "moon", "night", "chart"] }
];

// ---- Kurdish Central (Sorani) deck — same 56 cards, same order. ----
// First-pass translation; a native-speaker review pass is recommended
// before shipping, especially for rare/archaic tiles (astrolabe, siege).
const DECK_KU = [

    
    // done
   { secret: "سوارچاک", hint: "قەڵا",
    obvious: ["شمشێر", "زرێ", "قەڵغان", "ڕم", "ئەسپ", "پێشبڕکێ", "پاشا", "شاژن", "جەنگ", "هێرش"],
    medium: ["شەرەف", "دڵسۆزی", "ئەرک", "یاریدەدەری جەنگاوەر", "ڕاهێنان", "جەنگ", "دوژمن", "دەستگیرکردن", "بورج", "ئاڵا"],
    subtle: ["گەمارۆ", "تاج", "قەڵای بەهێز", "ئازا", "ئەسپی چاک", "ڕووبەڕووبوونەوە", "پاسەوان", "سوێند", "جوامێری", "ململانێی سەر ئەسپ"],
    bluff: ["سوارچاک", "قەڵا", "جەنگ", "زرێ", "قەڵغان", "شمشێر", "پاشا", "شاژن", "ئەسپ", "جەنگ"] },

// done
  { secret: "جادووگەر", hint: "مەنجەڵی جادوو",
    obvious: ["گسک", "دەرمانی جادوویی", "پەرتووکی جادوو", "بلور", "لێنان", "مۆم", "ویرد", "ئاژەڵی هاودەم", "گژوگیا", "مانگ"],
    medium: ["بازنە", "نیشانە", "جادوو", "نەفرەت", "تاریک", "فڕین", "دارستان", "قەلەڕەش", "کۆڵوانە", "ئاوێنە"],
    subtle: ["چرپە", "سێبەر", "ڕۆح", "مێژوویی", "کۆڕی جادووگەران", "ئەفسوون", "تەم", "ئەستێرە", "مەنجەڵی جادوو", "شەو"],
    bluff: ["جادووگەر", "جادوو", "تەڵیسم", "دەرمانی جادوویی", "مەنجەڵی جادوو", "بلور", "مانگ", "دارستان", "تاریک", "قەلەڕەش"] },
// done
  { secret: "شۆکەک", hint: "ڕۆح",
    obvious: ["خێو", "سێبەر", "ئێکتۆپلازم", "ناوەندگر", "شۆکەک لێدراو", "چرپە", "تاریکایی", "سەرمام", "زنجیر", "ترس"],
    medium: ["دەنگی پێ", "یادەوەری", "سەرمای لەناکاو", "تەواونەکراو", "کزبڵێسە", "مردوو", "قیژە", "تاریکی", "چڕەچڕ", "کۆن"],
    subtle: ["شوم", "ترسی گەورە", "بۆشایی", "گۆڕ", "ڕۆح", "بینینی کاتی", "سەروو سروشت", "ترسێنەر", "دەنگدانەوە", "گیان"],
    bluff: ["شۆکەک", "شۆکەک لێدراو", "ڕۆح", "خێو", "تاریکی", "ترس", "قیژە", "کۆن", "سێبەر", "چرپە"] },
// done
  { secret: "کازینۆ", hint: "پڕمەترسی",
    obvious: ["ڕولێت", "جاکپۆت", "پۆکەر", "بلاک جاک", "چپس", "زار", "کارتەکان", "گرەو", "سەرمایەی گەورە", "دابەشکەر"],
    medium: ["بەخت", "بلۆف", "گرژی", "سیستەم", "نیشانە", "مەترسی", "براوە", "دۆڕاو", "پارە", "یاری"],
    subtle: ["نۆرە", "سەیرکردن", "بێدەنگی", "پەستان", "ستراتیژی", "قومار", "شانس", "فێڵ", "مەخمەڵ", "کازینۆ"],
    bluff: ["کازینۆ", "پۆکەر", "ڕولێت", "زار", "چپس", "گرەو", "بەخت", "دابەشکەر", "براوە", "پارە"] },
// done
  { secret: "شانۆ", hint: "سەکۆ",
    obvious: ["ڕووناکی تیشکۆ", "پەردە", "تاکبێژی", "چەپڵەلێدان", "دەق", "بەرگ", "پشتی شانۆ", "ڕاهێنان", "ماکیاژ", "ئەکتەر"],
    medium: ["سۆز", "کاتسازی", "هەناسە", "دەمامک", "بێئامادەکاری", "نواندن", "سەکۆ", "ڕۆڵ", "دیمەن", "چوونەدەرەوە"],
    subtle: ["نواندن", "قەرەباڵغی", "ڕووناکیەکان", "دەنگ", "ئاوێنە", "دراما", "بینەران", "کارەکتەر", "دیالۆگ", "شانۆگەری"],
    bluff: ["شانۆ", "سەکۆ", "ئەکتەر", "دەق", "پەردە", "چەپڵەلێدان", "نواندن", "ڕووناکیەکان", "ڕۆڵ", "شانۆگەری"] },
// done
  { secret: "قەڵا", hint: "شانشین",
    obvious: ["پاشا", "شاژن", "تەخت", "زرێ", "تاج", "سوارچاک", "خەندەق", "پردی هەڵبڕاو", "بورج", "شانشین"],
    medium: ["شاهانە", "دادگا", "گەمارۆ", "ئاڵا", "بەرد", "هۆڵ", "پاسەوان", "مەلقەب", "خوان", "جەنگ"],
    subtle: ["دەسەڵات", "مێژوو", "کۆن", "کەلەپوور", "قەڵای ناوخۆ", "قەڵای بەهێز", "نەجیبزادە", "ڕێڕەوی نهێنی", "جێنشین", "قەڵا"],
    bluff: ["قەڵا", "پاشا", "شاژن", "سوارچاک", "تاج", "تەخت", "زرێ", "خەندەق", "شاهانە", "بورج"] },
// done
  { secret: "خانخوێ", hint: "مەیخانە",
    obvious: ["مەی", "کوورەی ئاگر", "قەڵای ناوخۆ", "خاوەن خان", "ژوورەکان", "گشتی", "ژێرزەمینی مەی", "چێشتخانە", "میوان", "مەیخانە"],
    medium: ["گەرم", "کۆبوونەوە", "سەفەرکەر", "میواندۆستی", "ئاگر", "کورسی درێژ", "مانەوە", "دێهات", "کۆن", "خانخوێ"],
    subtle: ["حەوانەوە", "بێدەنگ", "ڕزگاربوون", "گوند", "بان", "شەو", "چیرۆک", "خۆش و گەرم", "بڵێسەدار", "خانخوێ"],
    bluff: ["خانخوێ", "مەیخانە", "مەی", "کوورەی ئاگر", "میوان", "ئاگر", "گەرم", "ژوورەکان", "خاوەن خان", "سەفەرکەر"] },
// done
  { secret: "کیمیاگەر", hint: "تاقیگە",
    obvious: ["دەرمانی جادوویی", "ئێلێکسیر", "بلور", "شوشەی دەرمان", "لێنان", "دڵۆپاندن", "ئاگر", "شووشە", "کیمیاگەری", "مێزی کار"],
    medium: ["فلۆسک", "تۆز", "خەڵوز", "کوڵاندنی هێواش", "کارتێکەر", "مێژوویی", "ڕەفە", "خوێندن", "دانایی", "کیمیاگەر"],
    subtle: ["ڕەچەتە", "هاوسەنگی", "ڕوون", "شاگرد", "شوشۆکە", "کارتێکەری خێرا", "پێکهاتن", "گۆڕانکاری", "مەعدەن", "کیمیاگەر"],
    bluff: ["کیمیاگەر", "دەرمانی جادوویی", "ئێلێکسیر", "بلور", "شوشەی دەرمان", "لێنان", "ئاگر", "شووشە", "تاقیگە", "مێزی کار"] },
// done
  { secret: "مەیخانە", hint: "خواردنەوەکان",
    obvious: ["باڕ", "پەرداخ", "مەی", "خاوەن باڕ", "کورسی چوارپێ", "بەرمیل", "گۆزەی مەی", "شێری بەرمیل", "ژێرزەمینی مەی", "مەیخانە"],
    medium: ["گەرم", "ئاگر", "پێکەنین", "گۆرانی", "زار", "کارتەکان", "قسەوباس", "کڕیار", "قەڵای ناوخۆ", "مەیخانە"],
    subtle: ["هاوڕێیەتی", "درەوشانەوە", "کۆنەساڵ", "مێزی سەرەکی", "بێدەنگ", "شوشە", "سەفەر", "چیرۆک", "پەرداخ", "مەیخانە"],
    bluff: ["مەیخانە", "باڕ", "مەی", "پەرداخ", "خاوەن باڕ", "ئاگر", "بەرمیل", "گۆرانی", "کارتەکان", "کڕیار"] },
// done
  { secret: "زیندانی ژێرزەمین", hint: "تاریک",
    obvious: ["زنجیرەکان", "ژووری بەندکردن", "ئەشکەنجە", "بەندکراو", "سەرۆکی زیندان", "تاریکی", "مشک", "ئامێری ئەشکەنجە", "زیندانی ژێرزەمین", "ئاسن"],
    medium: ["شێدار", "بەرد", "پاسەوان", "ڕزگاربوون", "تەنیایی", "زیندانی بیروولکە", "تونێل", "شێشەڵبەند", "زیندانی ژێرزەمین", "بەندینخانە"],
    subtle: ["بێدەنگی", "دەنگدانەوە", "داوی جاڵجاڵۆکە", "بێهیوا", "بێڕووناکی", "ڕێڕەو", "فەرامۆشکراو", "ناڵە", "شوێنپێی کۆن", "زیندانی ژێرزەمین"],
    bluff: ["زیندانی ژێرزەمین", "بەندینخانە", "ژووری بەندکردن", "زنجیرەکان", "سەرۆکی زیندان", "مشک", "تاریکی", "بەرد", "پاسەوان", "ڕزگاربوون"] },
// done
  { secret: "کۆشک", hint: "کۆن",
    obvious: ["ژووری سەما", "شەمعەدان", "پێچاوپێچ", "ژووری میوان", "سەرکارکەر", "فۆیێ", "خوێندن", "بلور", "وێنەی کێشراو", "کۆشک"],
    medium: ["مۆڵگەی گەورە", "کۆنەجاجم", "دێرین", "کتێبخانە", "زیو", "پەرژینی ڕوەکی", "باخچە", "مەزن", "ڕێکپۆشی", "کۆشک"],
    subtle: ["تۆزوباخ", "نهێنی", "دەنگدانەوە", "سێبەر", "چۆڵکراو", "چڕەچڕ", "سەربان", "کەوانەیی", "دەوڵەمەندی", "کۆشک"],
    bluff: ["کۆشک", "کۆن", "مۆڵگەی گەورە", "ژووری سەما", "شەمعەدان", "سەرکارکەر", "خوێندن", "وێنەی کێشراو", "باخچە", "مەزن"] },
// done
  { secret: "کەنیسەی گەورە", hint: "پیرۆز",
    obvious: ["شوشەی ڕەنگاوڕەنگ", "ئۆرگ", "دانپێدانان", "کورسی کەنیسە", "زەنگ", "تاقەی کەنیسە", "قوربانگا", "مێزی خوێندنەوە", "بۆنخۆشی", "سروودی ئاینی"],
    medium: ["بەرد", "کەوانە", "پیرۆز", "سروودی بەکۆمەڵ", "گۆتیک", "چۆکدادان", "گوڵەباخەکان", "ئامۆژگاری", "ڕێزدار", "کەنیسەی گەورە"],
    subtle: ["بێدەنگ", "کزبڵێسە", "باڵی کەنیسە", "مەزنایەتی", "ڕووناکی", "پەرستش", "پەناگەی پیرۆز", "بورج", "کەنیسەی گەورە", "پیرۆز"],
    bluff: ["کەنیسەی گەورە", "کەنیسە", "شوشەی ڕەنگاوڕەنگ", "ئۆرگ", "زەنگ", "قوربانگا", "کورسی کەنیسە", "بەرد", "پیرۆز", "سروودی بەکۆمەڵ"] },
// done
  { secret: "کتێبخانە", hint: "پەرتووکەکان",
    obvious: ["ڕەفە", "پەرتووکی گەورە", "پەرتووک", "کتێبخانەوان", "کەتەلۆگ", "لەمپا", "خوێندنەوە", "ئەرشیف", "تۆزوباخ", "کارت"],
    medium: ["خوێندن", "گۆی زەوی", "بێدەنگی", "دەوڵەمەندی", "زانیاری", "پەڕە", "پیت", "مێژوو", "کتێبدۆست", "کتێبخانە"],
    subtle: ["بێدەنگ", "فێربوون", "کۆن", "بەرگکردن", "مەرەکەب", "کاغەز", "کارەکتەر", "کلاسیک", "دانایی", "کتێبخانە"],
    bluff: ["کتێبخانە", "پەرتووکەکان", "ڕەفە", "خوێندنەوە", "پەرتووکی گەورە", "کتێبخانەوان", "کەتەلۆگ", "لەمپا", "خوێندن", "زانیاری"] },
// done
  { secret: "ئاسنگەری", hint: "ئاگر",
    obvious: ["ئاسنگەری", "سەندان", "چەکوش", "فووکارە", "ئاسن", "پڕووشک", "دەمی چەقۆ", "ئەنبەر", "مەعدەن", "ئاگر"],
    medium: ["درەوشانەوە", "دووکەڵ", "لێدان", "زەنگدانەوە", "دوکانی ئاسنگەر", "چەک", "زرێ", "گەرمی", "ئاسنگەری", "کار"],
    subtle: ["فیشەفیشی ئاو", "دوود", "ڕیتم", "پارچە ئاسن", "پیشەگەری", "خاوەمەعدەن", "تەقەتەق", "کارامەیی", "ئاسنگەری", "سەندان"],
    bluff: ["ئاسنگەری", "ئاگر", "سەندان", "چەکوش", "ئاسن", "دەمی چەقۆ", "دوکانی ئاسنگەر", "گەرمی", "پڕووشک", "چەک"] },
// done
  { secret: "مەزارگا", hint: "خاکسپاردن",
    obvious: ["تابووتی بەردین", "هەرەم", "فیرعەون", "هیرۆگلیف", "گۆزەی مومیا", "بەرد", "ژوور", "دەمامک", "مۆری پارێزەر", "مەزارگا"],
    medium: ["سەرداب", "هێما", "گەنجینە", "مومیا", "قڵیشاو", "بیرۆکەی قووڵ", "پاسەوان", "ڕۆح", "پیاوی ئاینی", "مەزارگا"],
    subtle: ["هەمیشەیی", "تاریکی", "پشوو", "دەنگدانەوە", "پارێزراو", "ئەبولهۆل", "لم", "دەروازە", "نێواندەشت", "مەزارگا"],
    bluff: ["مەزارگا", "خاکسپاردن", "هەرەم", "فیرعەون", "تابووتی بەردین", "هیرۆگلیف", "مومیا", "سەرداب", "بەرد", "دەمامک"] },
// done
  { secret: "پەرستگا", hint: "پیرۆز",
    obvious: ["پەرستگا", "دەروازەی تۆری", "بەرد", "پێشکەشکراو", "غەیببێژ", "فانۆس", "کڕنۆشبردن", "قەشەی بودی", "بۆنخۆشی", "پەرستگا"],
    medium: ["ئاشتی", "نزاکردن", "پەت", "چرپە", "پارێزەر", "پیرۆز", "سەرکەوتن", "دار", "دەروازە", "پەرستگا"],
    subtle: ["بێدەنگی جدی", "ڕووناکی", "کپبوون", "پەیمان", "پشکۆتنی گوڵ", "دەنگی پێ", "زەنگۆڵە", "ڕۆح", "بەرەوژوور", "پەرستگا"],
    bluff: ["پەرستگا", "پیرۆز", "بەرد", "پێشکەشکراو", "دەروازەی تۆری", "فانۆس", "نزاکردن", "قەشەی بودی", "بۆنخۆشی", "ئاشتی"] },
// done
  { secret: "سەرداب", hint: "زیندانی ژێرزەمین",
    obvious: ["سەرداب", "تابووت", "ئێسقان", "پەیکەری ئێسقان", "قوربانگا", "مەشخەڵ", "تۆزوباخ", "داوی جاڵجاڵۆکە", "کێلی گۆڕ", "کەلەسەر"],
    medium: ["کفن", "ژوور", "مۆم", "تاریک", "دەنگدانەوە", "کەوانە", "بەرد", "ستالاکتیت", "تابووتی بەردین", "سەرداب"],
    subtle: ["بێدەنگی", "کۆن", "فەرامۆشکراو", "سەرمام", "نزاکردن", "تەپوتۆز", "ماتی", "یادەوەری", "حەرەمی پیرۆز", "سەرداب"],
    bluff: ["سەرداب", "زیندانی ژێرزەمین", "تابووت", "ئێسقان", "پەیکەری ئێسقان", "قوربانگا", "تۆزوباخ", "مۆم", "کێلی گۆڕ", "کەلەسەر"] },
// done
  { secret: "گەمارۆ", hint: "جەنگ",
    obvious: ["مەنجەنیق", "دەرگاڕووخێن", "دیوار", "شەڕ", "تڕێبووشێت", "تیغ", "بورج", "بەربەست", "هێرش","گەمارۆ"],
    medium: ["کەمپ", "ئاڵا", "قەڵا", "دەورەدان", "ئاڵای نیشانە", "کەلێن", "بەرد", "ورە", "مەکینەی جەنگ", "گەمارۆ"],
    subtle: ["بنبەست", "گرژی", "تۆزوباخ", "کەرەستەی بژێوی", "قۆچ", "فریاکەوتن", "زرێ", "هێرش", "گەمارۆ", "جەنگ"],
    bluff: ["گەمارۆ", "جەنگ", "مەنجەنیق", "قەڵا", "شەڕ", "تیغ", "بورج", "دیوار", "کەمپ", "ئاڵا"] },

// done
  { secret: "پەڕەی پێست", hint: "تۆمار",
    obvious: ["پەڕەی پێست", "پێنووسی پەڕ", "مەرەکەب", "تۆمار", "مۆر", "دەستنووس", "پێستی ناسک", "نامە", "ڕێنووسی نووسراو", "پەڕەی پێست"],
    medium: ["کاغەز", "بەڵگەنامە", "مێژوو", "کتێبخانە", "شاکار", "ئیمزا", "نووسەر", "پەرتووک", "پەڕەی پێست", "کۆن"],
    subtle: ["ناسک", "زەردبوو", "دەست", "تۆمارکردن", "ڕێنووسی بێگەرد", "گوێرەکە", "نامەی ئاینی", "ئەرشیف", "پەڕەی پێست", "کۆنەسال"],
    bluff: ["پەڕەی پێست", "تۆمار", "پێنووسی پەڕ", "مەرەکەب", "نامە", "مۆر", "دەستنووس", "پێستی ناسک", "بەڵگەنامە", "کۆنەسال"] },
// done
  { secret: "ڕوانگە", hint: "ئاسمان",
    obvious: ["دووربین", "قوبە", "گەڕەستێرە", "ئەستێرە", "گەردوونناس", "خولگە", "تەمەئەستێرە", "خشتە", "سەربانی کەوانەیی", "ڕوانگە"],
    medium: ["شەو", "کۆمەڵەئەستێرە", "ئامراز", "زیو", "سەرنجدان", "ئاوێنە", "مانگ", "ڕۆژی", "چاوپێکەوتن", "ڕوانگە"],
    subtle: ["ئاسمانەکان", "تەنیایی", "ڕووناکی", "سەرسامی", "تاریک", "گێڕ", "بان", "زانست", "گەردوون", "ڕوانگە"],
    bluff: ["ڕوانگە", "دووربین", "ئەستێرەکان", "گەڕەستێرە", "قوبە", "گەردوونناس", "خولگە", "مانگ", "شەو", "خشتە"] }
];

export const DECK = { en: DECK_EN, ku: DECK_KU };

export const NPCS = [
  { id:"brute", name:"Gruff Halloran", name_ku:"گراف هاڵۆران", chip:"#b98a4f", aggression:0.8, caution:0.25, tell:0.25,
    thinkMs:[900,1700] },
  { id:"widow", name:"Madame Vey",     name_ku:"مادام ڤێی",   chip:"#9c6b7c", aggression:0.35, caution:0.75, tell:0.12,
    thinkMs:[1600,2600] },
  { id:"fox",  name:"Silky Marlowe",   name_ku:"سیلکی مارلۆ",  chip:"#8fa06b", aggression:0.55, caution:0.5,  tell:0.4,
    thinkMs:[700,1400] },
  // Full House mode only — two more chairs at the table
  { id:"hawk", name:"Deacon Rourke",   name_ku:"دیاکۆن ڕۆرک",  chip:"#5c6b78", aggression:0.65, caution:0.45, tell:0.18,
    thinkMs:[1100,1900] },
  { id:"crow", name:"Old Ma Kessler",  name_ku:"پیرەژن کێسلەر", chip:"#4a3a52", aggression:0.25, caution:0.85, tell:0.08,
    thinkMs:[2000,3200] },
];

export const RULES = {
  seats: 4,
  maxRounds: 4,
  handSize: 4,
  weights: { obvious:3, medium:2, subtle:1 },
};
