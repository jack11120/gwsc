import "./globals.css";

export const metadata = {
  title: "GWSC 表白墙",
  description: "GWSC Confession Wall"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
