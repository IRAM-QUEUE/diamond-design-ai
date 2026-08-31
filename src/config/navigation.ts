import { Gem, Image, LetterText, Plus, UserRound } from "lucide-react";

export const navigationItems = [
  {
    title: "New Design",
    titleAr: "تصميم جديد",
    href: "/chat",
    icon: Plus
  },
  {
    title: "My Designs",
    titleAr: "تصاميمي",
    href: "/gallery",
    icon: Image
  },
  {
    title: "Inspiration",
    titleAr: "إلهام",
    href: "/inspiration",
    icon: Gem
  },
  {
    title: "Fonts & Styles",
    titleAr: "الخطوط والأساليب",
    href: "/fonts",
    icon: LetterText
  },
  {
    title: "Profile",
    titleAr: "الملف الشخصي",
    href: "/settings",
    icon: UserRound
  }
];
