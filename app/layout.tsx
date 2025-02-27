import { Analytics } from '@vercel/analytics/react';

import Footer from "@components/Footer";
import Navbar from "@components/Navbar";
import "@styles/Home.module.css";
import "@styles/globals.css";
import { Montserrat } from "next/font/google";
import Script from "next/script";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-mont" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} bg-light dark:bg-dark font-sans w-full min-h-screen`}
      >
        <Script id="theme-switcher" strategy="beforeInteractive">
          {
            `if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark')
            }
            else {
              document.documentElement.classList.remove('dark')
            }`
          }
        </Script>
        <Navbar />
        {children}
        <Footer />
        <Analytics/>
      </body>
    </html>
  );
}
