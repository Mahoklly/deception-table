// The Deception Table — all player-visible strings live here.
// Two languages: English (default) and Kurdish Central (Sorani, secondary).
// STR is a live, mutable object — setLang() rewrites its contents in place
// so every existing `STR.xxx` read across the codebase picks up the swap
// without needing to touch each call site.
export const LANGS = ["en", "ku"];
export const LANG_LABELS = { en: "English", ku: "کوردی (سۆرانی)" };

const STRINGS = {
en: {
  title_blurb: "Three of you share a secret word. One of you only has a hint. Say a word each round — subtle enough to hide the secret, clear enough to prove you know it. Then vote. The revolver settles the rest.",
  start: "Deal the Cards",
  play_again: "Deal Again",
  loading: "Lighting the lantern…",
  round_tag: "Round {r} of {max}",
  vote_tag: "The Vote",
  your_card_label: "Your card",
  imposter_card: "IMPOSTER",
  imposter_hint: "hint: {h}",
  hold_to_peek: "Hold to peek at your card",
  prompt_your_turn: "Your turn. Choose your word carefully…",
  prompt_waiting: "{n} is thinking…",
  prompt_vote: "Who is the imposter? Cast your vote.",
  prompt_revote: "The chamber was empty. One more round — then vote again.",
  call_vote: "Call the Vote",
  tier_obvious: "bold",
  tier_medium: "steady",
  tier_subtle: "sly",
  tier_bluff: "bluff",
  said: "{w}",
  banner_tie: "DEAD EVEN — THE CHAMBER CLICKS EMPTY",
  banner_shot: "{n} TAKES THE BULLET",
  banner_was_imposter: "{n} WAS THE IMPOSTER",
  banner_was_innocent: "{n} WAS INNOCENT",
  banner_you_shot: "YOU TAKE THE BULLET",
  win_crew_title: "THE TABLE <span class='accent'>HOLDS</span>",
  win_crew_body: "The imposter, {n}, is face-down in the sawdust. The secret word was “{w}”. The regulars drink to your health.",
  win_imp_title: "THE <span class='accent'>IMPOSTER</span> WINS",
  win_imp_body: "Too many innocents took the bullet. {n} never knew the word was “{w}” — and never needed to.",
  win_you_imp_title: "A <span class='accent'>PERFECT</span> LIE",
  win_you_imp_body: "You bluffed your way through with nothing but “{h}”. The word was “{w}”. Nobody ever knew.",
  lose_you_shot_title: "YOU WERE <span class='accent'>INNOCENT</span>",
  lose_you_shot_body: "The table turned on you. The imposter, {n}, smiles into their glass. The word was “{w}”.",
  lose_you_imp_title: "CAUGHT <span class='accent'>RED-HANDED</span>",
  lose_you_imp_body: "They saw through your bluff. The word you never knew was “{w}”.",
  votes_for: "{c} vote{s}",
  you: "You",
  dead_tag: "✝",
  deal_prompt: "The cards are dealt. Pick yours up…",
  tap_to_place: "Read it well — then tap anywhere to set it face-down.",
  tut_1: "Everyone says one word per round related to the secret card.",
  tut_2: "Bold words prove you're innocent — but teach the imposter the secret.",
  tut_3: "Sly words protect the secret — but make YOU look like the imposter.",
  game_title_html: "THE <span class='accent'>DECEPTION</span> TABLE",
  settings_title: "⚙️ Settings",
  settings_volume_label: "🎵 Music Volume",
  settings_language_label: "🌐 Language",
  settings_close: "Close",
  proveword_prompt: "Type the secret word to prove you're innocent:",
  proveword_placeholder: "Type the secret word...",
  confirm_btn: "Confirm",
  banner_proved_innocent_you: "✅ Innocent! You survive.",
  prompt_proved_innocent_you: "You proved your innocence!",
  banner_proved_wrong_final: "❌ Wrong! The word was \"{w}\". You die.",
  prompt_proved_failed_you: "You failed to prove your innocence.",
  prompt_proved_wrong_retry: "❌ Wrong! {n} attempt(s) left. Type the secret word:",
  prompt_proving_npc: "{n} must prove their innocence...",
  banner_proved_innocent_npc: "✅ {n} is innocent! They survive.",
  prompt_proved_innocent_npc: "{n} proved their innocence.",
  banner_proved_imposter_npc: "❌ {n} is the IMPOSTER! They die.",
  prompt_proved_failed_npc: "{n} failed to prove their innocence.",
},
ku: {
  title_blurb: "سێیان لەنێوان ئێوەدا نهێنیەکی هاوبەشیان هەیە. یەکێکتان تەنها ئاماژەیەکی هەیە. هەر خولێک وشەیەک بڵێ — بەقەد پێویست شاراوە بۆ پاراستنی نهێنییەکە، بەقەد پێویست ڕوون بۆ سەلماندنی زانینت. پاشان دەنگ بدە. تفەنگەکە پاشماوەکە چارەسەر دەکات.",
  start: "پەڕەکان دابەش بکە",
  play_again: "دووبارە دابەشیان بکە",
  loading: "چرا هەڵدەکرێت…",
  round_tag: "خولی {r} لە {max}",
  vote_tag: "دەنگدان",
  your_card_label: "پەڕەی تۆ",
  imposter_card: "ساختەکار",
  imposter_hint: "ئاماژە: {h}",
  hold_to_peek: "دابگرە بۆ بینینی پەڕەکەت",
  prompt_your_turn: "نۆرەی تۆیە. بە وریایی وشەکەت هەڵبژێرە…",
  prompt_waiting: "{n} بیر دەکاتەوە…",
  prompt_vote: "کێ ساختەکارە؟ دەنگت بدە.",
  prompt_revote: "تفەنگەکە بەتاڵ بوو. یەک خولی تر — پاشان دووبارە دەنگ بدە.",
  call_vote: "بانگی دەنگدان بکە",
  tier_obvious: "بەئازایی",
  tier_medium: "جێگیر",
  tier_subtle: "بە فێڵ",
  tier_bluff: "درۆ",
  said: "{w}",
  banner_tie: "یەکسانی تەواو — تفەنگەکە بەتاڵ بوو",
  banner_shot: "{n} تفەنگەکە دەگرێت",
  banner_was_imposter: "{n} ساختەکار بوو",
  banner_was_innocent: "{n} بێتاوان بوو",
  banner_you_shot: "تۆ تفەنگەکە دەگریت",
  win_crew_title: "خشتەکە <span class='accent'>بەردەوامە</span>",
  win_crew_body: "ساختەکارەکە، {n}، بەسەر زەویدا کەوت. وشە نهێنییەکە \"{w}\" بوو. خواردنگەییەکان بۆ تەندروستیت خواردیانەوە.",
  win_imp_title: "<span class='accent'>ساختەکار</span> براوە دەبێت",
  win_imp_body: "زۆر لە بێتاوانەکان تفەنگیان لێدرا. {n} هەرگیز وشەکەی نەزانی — پێویستیشی پێی نەبوو.",
  win_you_imp_title: "<span class='accent'>درۆیەکی</span> تەواو",
  win_you_imp_body: "تۆ بە هیچ شتێک نەبێت جگە لە \"{h}\" فێڵت کرد. وشەکە \"{w}\" بوو. کەس هەرگیز نەیزانی.",
  lose_you_shot_title: "تۆ <span class='accent'>بێتاوان</span> بوویت",
  lose_you_shot_body: "خشتەکە لە دژی تۆ گۆڕا. ساختەکارەکە، {n}، بە پەرداخەکەیدا پێدەکەنێت. وشەکە \"{w}\" بوو.",
  lose_you_imp_title: "بە <span class='accent'>دەستی سوور</span> گیرا",
  lose_you_imp_body: "ئەوان فێڵەکەی تۆیان بەدیکرد. وشەیەک کە هەرگیز نەتزانی \"{w}\" بوو.",
  votes_for: "{c} دەنگ",
  you: "تۆ",
  dead_tag: "✝",
  deal_prompt: "پەڕەکان دابەش کران. هی خۆت هەڵبگرە…",
  tap_to_place: "باش بیخوێنەوە — پاشان لە هەر شوێنێک دەست لێبدە بۆ دانانی بەرووی خوارەوە.",
  tut_1: "هەموو کەسێک هەر خولێک وشەیەک دەڵێت پەیوەندیدار بە پەڕە نهێنییەکەوە.",
  tut_2: "وشە ئاشکراکان بێتاوانیت دەسەلمێنن — بەڵام ساختەکار فێری نهێنییەکە دەکەن.",
  tut_3: "وشە بە فێڵەکان نهێنییەکە دەپارێزن — بەڵام وا لێدەکەن تۆ وەک ساختەکار دیار بیت.",
  game_title_html: "خشتەی <span class='accent'>درۆ</span>",
  settings_title: "⚙️ ڕێکخستنەکان",
  settings_volume_label: "🎵 دەنگی مۆسیقا",
  settings_language_label: "🌐 زمان",
  settings_close: "داخستن",
  proveword_prompt: "وشە نهێنییەکە بنووسە بۆ سەلماندنی بێتاوانیت:",
  proveword_placeholder: "وشە نهێنییەکە بنووسە…",
  confirm_btn: "دووپاتکردنەوە",
  banner_proved_innocent_you: "✅ بێتاوانیت! دەژیت.",
  prompt_proved_innocent_you: "تۆ بێتاوانیت سەلماند!",
  banner_proved_wrong_final: "❌ هەڵە! وشەکە \"{w}\" بوو. دەمریت.",
  prompt_proved_failed_you: "نەتتوانی بێتاوانیت بسەلمێنیت.",
  prompt_proved_wrong_retry: "❌ هەڵە! {n} هەوڵی تر ماوە. وشە نهێنییەکە بنووسە:",
  prompt_proving_npc: "{n} هەوڵ دەدات بێتاوانی خۆی بسەلمێنێت…",
  banner_proved_innocent_npc: "✅ {n} بێتاوانە! دەژی.",
  prompt_proved_innocent_npc: "{n} بێتاوانی خۆی سەلماند.",
  banner_proved_imposter_npc: "❌ {n} ساختەکارە! دەمرێت.",
  prompt_proved_failed_npc: "{n} نەیتوانی بێتاوانی خۆی بسەلمێنێت.",
},
};

function initialLang(){
  try{
    const saved = localStorage.getItem("lang");
    if(saved && STRINGS[saved]) return saved;
  }catch(e){}
  return "en";
}
let lang = initialLang();
export const STR = { ...STRINGS[lang] };
document.documentElement.setAttribute("data-lang", lang);

export function getLang(){ return lang; }
export function setLang(l){
  if(!STRINGS[l]) return;
  lang = l;
  Object.assign(STR, STRINGS[l]);
  document.documentElement.setAttribute("data-lang", lang);
  try{ localStorage.setItem("lang", lang); }catch(e){}
}
export function fmt(s, vars={}) {
  return s.replace(/\{(\w+)\}/g, (_,k)=> vars[k] !== undefined ? vars[k] : "{"+k+"}");
}
