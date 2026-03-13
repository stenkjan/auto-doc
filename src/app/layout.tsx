import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto Doc – AI Document Generator",
  description: "Prompt-driven document generation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
