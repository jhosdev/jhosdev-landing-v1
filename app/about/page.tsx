import { AnimatedNumbers } from "@components/AnimatedNumbers";
import AnimatedText from "@components/AnimatedText";
import Education from "@components/Education";
import Experience from "@components/Experience";
import LayoutComponent from "@components/LayoutComponent";
import Skills from "@components/Skills";
import TransitionEffect from "@components/transitionEffect";
import profilePic from "@public/images/profile/profile.jpg";
import Image from "next/image";

export const metadata = {
  title: "jhosdev - About",
  description: "About Page",
};

export default function Page() {
  return (
    <>
      <TransitionEffect />
      <main className="flex w-full flex-col items-center justify-center">
        <LayoutComponent className="pt-16">
          <AnimatedText text="Passion Fuels Purpose!" className="mb-16" />
          <div className="grid w-full grid-cols-8 gap-16">
            <div className="col-span-3 flex flex-col items-start justify-start">
              <h2 className="mb-2 text-lg font-bold uppercase text-dark/75 dark:text-white/75">
                Biography
              </h2>
              <p className="font-medium text-dark/75 dark:text-white/75">
                Hi, I&apos;m Jhosaim, passionate software engineer with a deep love for programming, particularly in the realms of backend development, software architecture, cloud computing, and artificial intelligence. 
              </p>
              
              <p className="my-4 font-medium text-dark/75 dark:text-white/75">
                My journey in software engineering has been driven by a insatiable curiosity and a strong desire to stay at the forefront of technological advancements. I find immense joy in solving complex problems and crafting efficient, scalable solutions that not only meet but exceed expectations.
              </p>

              <p className="my-4 font-medium text-dark/75 dark:text-white/75">
              I am constantly seeking opportunities to learn and grow, and I thrive in collaborative environments where I can contribute my expertise and learn from others. My goal is to leverage my technical skills and problem-solving abilities to build impactful software solutions that make a difference.
              </p>
              
            </div>
            <div className="col-span-3 relative h-max rounded-2xl border-2 border-solid border-dark bg-light p-8 dark:border-light dark:bg-dark">
              <div className="absolute top-0 -right-3 -z-10 w-[102%] h-[103%] rounded-[2rem] bg-dark dark:bg-light" />
              <Image
                src={profilePic}
                alt="jhos profile image"
                className="w-full h-auto rounded-2xl"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            <div className="col-span-2 flex flex-col items-end justify-between">
              <div className="flex flex-col items-end justify-center">
                <span className="inline-block text-7xl font-bold text-dark dark:text-white">
                  <AnimatedNumbers value={10} />+
                </span>
                <h2 className="text-xl font-medium capitalize text-dark/75 dark:text-white/75">
                  Programming Languaje Skills
                </h2>
              </div>
              <div className="flex flex-col items-end justify-center">
                <span className="inline-block text-7xl font-bold text-dark dark:text-white">
                  <AnimatedNumbers value={15} />+
                </span>
                <h2 className="text-xl font-medium capitalize text-dark/75 dark:text-white/75">
                  Projects Completed
                </h2>
              </div>
              <div className="flex flex-col items-end justify-center">
                <span className="inline-block text-7xl font-bold text-dark dark:text-white">
                  <AnimatedNumbers value={2} />+
                </span>
                <h2 className="text-xl font-medium capitalize text-dark/75 dark:text-white/75">
                  Years of Experience
                </h2>
              </div>
            </div>
          </div>
          <Skills />
          <Experience />
          <Education />
        </LayoutComponent>
      </main>
    </>
  );
}
