// Asset URL manifest — generated-asset CDN URLs (Higgsfield/CloudFront).
// Empty string = fall back to a relative ./assets/ file (or procedural placeholder).
export const ASSET_URLS = {
  room_tavern: "", // hook up a Higgsfield-generated room_tavern.glb here to replace the procedural box/beam room
  tex_wood_wall: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260717_073440_49fc9b5f-1b93-4009-b898-7ad36e0b8792.png",
  tex_wood_floor: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260717_073441_5f8da4b4-6709-43f4-8cd0-eeb4d8028521.png",
  tex_neon_bar: "", // served locally from ./assets/tex_neon_bar.png — the CDN copy doesn't allow cross-origin pixel reads, which silently broke the transparency cutout (applyOnceTexKeyed) and left the dark background opaque; same-origin local file fixes that
  tex_graffiti_mural: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260716_210136_67301b60-ed0f-487e-a8c9-c69c23cdc6e8.png",
  tex_posters: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260716_210139_3d6d33c5-4917-4ccd-9cbc-1d0849b1c0f0.png",
  tex_backlit_shelf: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260717_070850_0061aa79-f789-4303-bae7-1b86b7bef554.png",
  room_bar_shelf: "https://d3u0tzju9qaucj.cloudfront.net/7d051b5a-7bfe-49fe-a484-24e7b3a9458a/e58345df-52c6-4bef-bce7-e5af28cb6916.glb",
  liquor_shelf: "", // Meshy-generated back-bar shelf unit — served locally from ./assets/liquor_shelf.glb (meshopt-compressed)
  bartender: "", // Meshy-generated bartender character — served locally from ./assets/bartender.glb (meshopt-compressed)
  bg_table: "", // Meshy-generated pub table for the background high-tops — served locally from ./assets/bg_table.glb (meshopt-compressed; shipped untextured, tinted in code)
  bar_stool: "", // Meshy-generated bar stool (replaces every procedural one) — served locally from ./assets/bar_stool.glb (meshopt-compressed; shipped untextured, tinted in code)
  char_brute: "", // Gruff Halloran — Meshy-generated, served locally from ./assets/char_brute.glb (meshopt-compressed; shipped untextured, tinted in code)
  char_widow: "", // Madame Vey — served locally from ./assets/char_widow.glb (meshopt-compressed; shipped untextured, tinted in code)
  char_fox: "", // Silky Marlowe — served locally from ./assets/char_fox.glb (meshopt-compressed; shipped untextured, tinted in code)
  char_hawk: "", // Deacon Rourke (Full House) — served locally from ./assets/char_hawk.glb (meshopt-compressed; shipped untextured, tinted in code)
  char_crow: "", // Old Ma Kessler (Full House) — served locally from ./assets/char_crow.glb (meshopt-compressed; shipped untextured, tinted in code)
  table_tavern: "", // old table retired — using the new procedural poker-table design (makePokerTable in game.js) until a fresh GLB is hooked up here
  revolver: "", // now served locally from ./assets/revolver.glb (the user pushed the real file to the repo) instead of depending on the CDN
  ref_table: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260717_070848_b5c9817c-c548-4b79-b5ca-0708a1f606a3.png", // reference photo for Meshy image-to-3D — run this through Meshy yourself, send back the .glb URL
  ref_revolver: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260717_070849_d963749d-ba20-4cbe-b622-05cb9c8f5b7c.png", // reference photo for Meshy image-to-3D
  ref_bartender: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260717_070844_a28fc51a-6d58-4488-bc91-35dce5fcd390.png", // reference photo for Meshy image-to-3D
  ref_patron: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260717_070845_af161de6-eafc-44a5-af85-2db7b5cadb77.png", // reference photo for Meshy image-to-3D
  card_back: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260716_031553_01ad3219-a58e-4b3c-b78f-2167c2d6ebf5.png",
  music_tavern: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260716_031717_2b35779c-fe86-47c7-929f-2cef3c0678f0.m4a", // Radio station 1/4: "The Usual"
  music_radio_dust: "", // Radio station 2/4: "Dust & Whiskey" — drop an mp3 URL here
  music_radio_porch: "", // Radio station 3/4: "Back Porch Blues" — drop an mp3 URL here
  music_radio_static: "", // Radio station 4/4: "Smoke & Static" — drop an mp3 URL here
  sfx_gunshot: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260716_031724_70672ab9-88e2-4c91-af7d-c7431b4413a6.mp3",
  sfx_click: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260716_031730_d923a951-17c8-455d-b254-fc42c6cd9ba0.mp3",
  sfx_card: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260716_031738_7fc66976-87a9-4128-b64e-8a9e1cda2cd3.mp3",
  sfx_drum: "https://d8j0ntlcm91z4.cloudfront.net/user_3GYSPUl3vuJmpnWL91vihi2v6ZQ/hf_20260716_031744_0c23782b-8678-47dd-9637-af8a424b5334.mp3",
};
