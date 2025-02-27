import Image from "next/image";
import Link from "next/link";

import AnimatedText from "@components/AnimatedText";
import LayoutComponent from "@components/LayoutComponent";

import profilePic from "@public/images/profile/developer-pic-1.png";
import lightBulb from "@public/images/svgs/miscellaneous_icons_1.svg";

import HireMe from "@components/HireMe";
import { LinkArrow } from "@components/Icons";
import TransitionEffect from "@components/transitionEffect";

import { fetchSheetMap } from "@utils/googleSheets";

export const metadata = {
  title: 'jhosdev - Home',
  description: 'Home page',
}

interface LinkData {
  id: string;
  platform: string;
  link: string;
}

export default async function Page() {
  const linksMap = await fetchSheetMap<LinkData, "platform", "link">(
    "links",
    "platform",
    "link",
  );
  const resume = linksMap["resume"]?.default ?? "";
  const resume_es = linksMap["resume_es"]?.default ?? "";
  const email = linksMap["email"]?.default ?? "";

  return (
    <>
      <TransitionEffect />
      <main className="flex items-center text-dark w-full min-h-screen bg-light dark:bg-dark dark:text-light">
        <LayoutComponent className="pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="w-1/2">
              <Image src={profilePic} alt="profile image" priority sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="w-full h-auto" />
            </div>
            <div className="w-1/2 flex flex-col items-center self-center">
              <AnimatedText text="Turning Vision Into Reality With Code And Design." className="!text-6xl !text-left" />
              <h2 className="text-primary dark:text-primaryDark my-1 text-4xl font-extrabold">Software Engineer</h2>
              <p className="my-4 text-base font-medium">As a skilled software engineer, I am passionate about bringing creative ideas to life through innovative web applications. Explore my latest projects and articles, showcasing my expertise in web development.<br /><br /> I am always eager to take on new challenges and contribute to exciting projects, so if you want to say hello or talk about something, feel free to contact me!</p>
              <div className="flex items-center self-start mt-2">
                <Link
                  href={resume}
                  target="_blank"
                  download={true}
                  className="flex items-center bg-dark text-light p-2.5 px-6 rounded-lg text-lg font-semibold hover:bg-light hover:text-dark border-2 border-solid border-transparent hover:border-dark dark:bg-light dark:text-dark hover:dark:bg-dark hover:dark:text-light hover:dark:border-light"
                >
                  Resume - English <LinkArrow className="!w-5 ml-1" />
                </Link>
                <Link
                  href={resume_es}
                  target="_blank"
                  download={true}
                  className="flex items-center bg-dark text-light p-2.5 px-6 rounded-lg text-lg font-semibold hover:bg-light hover:text-dark border-2 border-solid border-transparent hover:border-dark dark:bg-light dark:text-dark hover:dark:bg-dark hover:dark:text-light hover:dark:border-light ml-4"
                >
                  Resume - Spanish <LinkArrow className="!w-5 ml-1" />
                </Link>
                <Link
                  href={`mailto:${email}`}
                  target="_blank"
                  className="ml-4 text-lg font-medium capitalize text-dark underline dark:text-light"
                >
                  Contact me!
                </Link>
              </div>
            </div>

          </div>
        </LayoutComponent>

        <HireMe />

        <div className="absolute right-8 bottom-8 inline-block w-24">
          <Image src={lightBulb} alt='light bulb image' className="w-full h-auto"></Image>
        </div>
      </main>

    </>
  );
}
