/* =====================================================================
   Site configuration — the ONLY file you need to edit to go live.
   Nothing secret belongs here. The Supabase anon key is designed to be
   public; Row Level Security (supabase/schema.sql) is what protects data.
   NEVER put a service_role key, email API key or password in this file.
   ===================================================================== */
window.XSR_CONFIG = {
  // 1) Supabase project (Project Settings → API). Leave blank until ready:
  //    forms will then show an honest "not connected" error instead of
  //    pretending to save.
  SUPABASE_URL: "https://poipkpyzoxjsjwdcmbzo.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_eWfL_nCxooxJaJiVQU2lxw_Neilf2dp",

  // 2) Owner email for the visitor-side "EMAIL US" mailto: button.
  //    Replace the placeholder with your real address. While it still
  //    contains "REPLACE", the button shows a notice instead of opening a
  //    draft addressed to a fake address.
  OWNER_EMAIL: "satyajit9090xa@gmail.com",

  MAILTO_SUBJECT: "Yamaha XSR 155 Website Inquiry",
  MAILTO_BODY:
    "Hello,\n\nI'm contacting you about the Yamaha XSR 155.\n\n[Write your message here]\n\nName:\nPhone (optional):\n",

  // 3) Test-ride locations shown in the booking form. Edit to your real
  //    dealerships / cities. "Other" lets visitors type their own.
  TEST_RIDE_LOCATIONS: ["Chennai", "Mumbai", "Delhi NCR", "Bengaluru", "Hyderabad", "Other (tell us in the message)"],

  // 4) Photography. Set each `src` to a photo you are licensed to use
  //    (your own, or supplied by your dealer/Yamaha under their terms).
  //    Entries with an empty src render as a designed, clearly-labelled
  //    "photograph pending" frame rather than a broken image.
  //    Suggested size: 2400px wide, JPG/WebP, < 400 KB each.
  

IMAGES: {
  hero: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-silver.webp?v=1762872732",
    alt: "Yamaha XSR 155 in Metallic Grey"
  },
  story_main: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-green.webp?v=1762872775",
    alt: "Yamaha XSR 155 in Greyish Green Metallic"
  },
  story_tank: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-red.webp?v=1762872754",
    alt: "Yamaha XSR 155 in Vivid Red"
  },
  story_lamp: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-blue.webp?v=1762872792",
    alt: "Yamaha XSR 155 in Metallic Blue"
  },
  feat_engine: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-silver.webp?v=1762872732",
    alt: "Yamaha XSR 155 in Metallic Grey"
  },
  feat_lamp: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-blue.webp?v=1762872792",
    alt: "Yamaha XSR 155 in Metallic Blue"
  },
  feat_dash: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-green.webp?v=1762872775",
    alt: "Yamaha XSR 155 in Greyish Green Metallic"
  },
  feat_chassis: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-silver.webp?v=1762872732",
    alt: "Yamaha XSR 155 in Metallic Grey"
  },
  feat_wheels: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-red.webp?v=1762872754",
    alt: "Yamaha XSR 155 in Vivid Red"
  },
  feat_seat: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-green.webp?v=1762872775",
    alt: "Yamaha XSR 155 in Greyish Green Metallic"
  },
  riding: {
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr_black.webp?v=1773479275",
    alt: "Yamaha XSR 155 in Metallic Black"
  }
},

// Yamaha India colour variants
COLOURS: [
  {
    id: "metallic-blue",
    label: "Metallic Blue",
    swatch: "#2f4b78",
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-blue.webp?v=1762872792",
    alt: "Yamaha XSR 155 in Metallic Blue"
  },
  {
    id: "vivid-red",
    label: "Vivid Red",
    swatch: "#b3282b",
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-red.webp?v=1762872754",
    alt: "Yamaha XSR 155 in Vivid Red"
  },
  {
    id: "metallic-grey",
    label: "Metallic Grey",
    swatch: "#9a9c9f",
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-silver.webp?v=1762872732",
    alt: "Yamaha XSR 155 in Metallic Grey"
  },
  {
    id: "greyish-green",
    label: "Greyish Green Metallic",
    swatch: "#5d6a58",
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr155-green.webp?v=1762872775",
    alt: "Yamaha XSR 155 in Greyish Green Metallic"
  },
  {
    id: "metallic-black",
    label: "Metallic Black",
    swatch: "#1a1a1a",
    src: "https://shop.yamaha-motor-india.com/cdn/shop/files/xsr_black.webp?v=1773479275",
    alt: "Yamaha XSR 155 in Metallic Black"
  }
],

// Gallery
GALLERY: [
  { key: "hero", caption: "Yamaha XSR 155 — Metallic Grey" },
  { key: "story_tank", caption: "Yamaha XSR 155 — Vivid Red" },
  { key: "feat_lamp", caption: "Yamaha XSR 155 — Metallic Blue" },
  { key: "feat_seat", caption: "Yamaha XSR 155 — Greyish Green" },
  { key: "feat_wheels", caption: "Yamaha XSR 155 — Vivid Red" },
  { key: "riding", caption: "Yamaha XSR 155 — Metallic Black" }
],

// Social links: empty links remain hidden
SOCIAL: {
  instagram: "https://www.instagram.com/yamahamotorindia/",
  youtube: "https://www.youtube.com/@IndiaYamahaMotor",
  facebook: "https://www.facebook.com/IndiaYamahaMotor/"
}
};
