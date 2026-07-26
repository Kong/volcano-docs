import type { ComponentProps } from "react";

// Inlined icon set from the Figma design (lucide glyphs, exact exported path
// data). Inlined rather than <img>-referenced so `stroke="currentColor"`
// inherits the surrounding text color and adapts to light/dark themes.
type IconProps = ComponentProps<"svg">;

export function FlameIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 19.6667 26.3333"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path d="M9.83333 0.500006C10.7222 4.05556 12.5 6.94445 15.1667 9.16667C17.8333 11.3889 19.1667 13.8333 19.1667 16.5C19.1667 18.9754 18.1833 21.3493 16.433 23.0997C14.6827 24.85 12.3087 25.8333 9.83333 25.8333C7.35798 25.8333 4.98401 24.85 3.23367 23.0997C1.48333 21.3493 0.5 18.9754 0.5 16.5C0.5 15.0575 0.967853 13.654 1.83333 12.5C1.83333 13.3841 2.18452 14.2319 2.80964 14.857C3.43477 15.4822 4.28261 15.8333 5.16667 15.8333C6.05072 15.8333 6.89857 15.4822 7.52369 14.857C8.14881 14.2319 8.5 13.3841 8.5 12.5C8.5 9.83334 6.5 8.50001 6.5 5.83334C6.5 4.05556 7.61111 2.27778 9.83333 0.500006Z" />
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 22.3333 19.6667"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path d="M11.1667 19.1667H21.8333M0.5 16.5L8.5 8.5L0.5 0.5" />
    </svg>
  );
}

export function BotIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 27.6667 22.3333"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path d="M13.8333 5.83333V0.5H8.5M0.5 13.8333H3.16667M24.5 13.8333H27.1667M17.8333 12.5V15.1667M9.83333 12.5V15.1667M5.83333 5.83333H21.8333C23.3061 5.83333 24.5 7.02724 24.5 8.5V19.1667C24.5 20.6394 23.3061 21.8333 21.8333 21.8333H5.83333C4.36057 21.8333 3.16667 20.6394 3.16667 19.1667V8.5C3.16667 7.02724 4.36057 5.83333 5.83333 5.83333Z" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path d="M12.5 12.5L9.60667 9.60667M11.1667 5.83333C11.1667 8.77885 8.77885 11.1667 5.83333 11.1667C2.88781 11.1667 0.5 8.77885 0.5 5.83333C0.5 2.88781 2.88781 0.5 5.83333 0.5C8.77885 0.5 11.1667 2.88781 11.1667 5.83333Z" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 5 9"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path d="M0.5 8.5L4.5 4.5L0.5 0.5" />
    </svg>
  );
}
