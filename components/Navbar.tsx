"use client";
import Link from "next/link";
import Logo from "./Logo";
import { usePathname } from "next/navigation";

import { GithubIcon,LinkedInIcon,DiscordIcon, SunIcon, MoonIcon } from "./Icons";

import {motion} from 'framer-motion'
import useThemeSwitcher from "./hooks/useThemeSwitcher";

type CustomLinkProps = {
  href: string;
  title: string;
  className?: string;
};

const CustomLink = ({ href, title, className = "" }: CustomLinkProps) => {
  const pathname = usePathname();

  return (
    <Link href={href} className={`${className} relative group`}>
      {title}

      <span
        className={`h-[1px] inline-block bg-dark absolute left-0 -bottom-0.5 group-hover:w-full transition-[width] ease duration-300 ${
          pathname === href ? "w-full" : "w-0"
        } dark:bg-light`}
      >
        &nbsp;
      </span>
    </Link>
  );
};

const Navbar = () => {

  const [mode, setMode] = useThemeSwitcher();

  return (
    <header className="w-full px-32 py-8 font-medium flex items-center justify-between text-dark dark:text-light bg-light dark:bg-dark">
      <nav>
        <CustomLink href="/" title="Home" className="mr-4" />
        <CustomLink href="/about" title="About" className="mx-4" />
        <CustomLink href="/projects" title="Projects" className="mx-4" />
        <CustomLink href="/articles" title="Articles" className="ml-4" />
      </nav>
      
      
      <nav className="flex items-center justify-center flex-wrap">
        <p className="bg-dark text-light dark:bg-light dark:text-dark px-3 mr-3 capitalize rounded-lg text-lg font-semibold">find me on:</p>
        
        <motion.a href="https://github.com/jhosdev" target="_blank" whileHover={{y:-2}} whileTap={{scale:0.9}} className="w-9 mr-3">
          <GithubIcon/>
        </motion.a>
        <motion.a href="https://www.linkedin.com/in/jhosdev/" target="_blank" whileHover={{y:-2}} whileTap={{scale:0.9}} className="w-9 mx-3">
          <LinkedInIcon/>
        </motion.a>
        <motion.a href="https://discordapp.com/users/Jhosaim#8678" target="_blank" whileHover={{y:-2}} whileTap={{scale:0.9}} className="w-9 ml-3">
          <DiscordIcon/>
        </motion.a>

        <button onClick={() => setMode(mode === "light" ? "dark" : "light")}
        className={`ml-6 flex items-center justify-center rounded-full p-1 ${mode ==="light"?"bg-dark text-light" : "bg-light text-dark" }`}>
          {
            mode === 'dark' ?
            <SunIcon className="fill-dark"/>
            : <MoonIcon className="fill-dark"/>
          }
        </button>

      </nav>

      <div className="absolute left-[50%] top-2 translate-x-[-50%]">
        <Logo />
      </div>
    </header>
  );
};

export default Navbar;
