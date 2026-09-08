import { Gem, Image, LetterText, MessageCircle, UserRound } from "lucide-react";

export const navigationItems = [
  {
    title: "Chat",
    titleAr: "المحادثة",
    href: "/chat",
    icon: MessageCircle
  },
  {
    title: "My Wishlist",
    titleAr: "قائمة أمنياتي",
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
