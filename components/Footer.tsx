import Link from "next/link"
import LayoutComponent from "./LayoutComponent"

const Footer = () => {
  return (
    <footer className="w-full border-t-2 border-solid border-dark font-medium text-lg text-dark dark:text-light dark:border-white">
        <LayoutComponent className="py-8 flex items-center justify-between">
            <span>{new Date().getFullYear()} &copy; All Rights Reserved.</span>
            <div className="flex items-center">
                Build with
                <span className="text-primary dark:text-primaryDark text-2xl px-1">&#9825;</span>
                by&nbsp;<Link href="https://github.com/jhosdev" className="underline underline-offset-2">jhosDev</Link>
            </div>
            <Link href="https://www.linkedin.com/in/jhosdev/" target={"_blank"} className="underline underline-offset-2">Say hello</Link>
        </LayoutComponent>
    </footer>
  )
}

export default Footer