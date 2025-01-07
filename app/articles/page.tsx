import AnimatedText from "@components/AnimatedText";
import LayoutComponent from "@components/LayoutComponent";

import article1 from "@public/images/articles/create loading screen in react js.jpg";
import article2 from "@public/images/articles/form validation in reactjs using custom react hook.png";
import article3 from "@public/images/articles/todo list app built using react redux and framer motion.png";
import article4 from "@public/images/articles/todo list app built using react redux and framer motion.png";

import TransitionEffect from "@components/transitionEffect";


export const metadata = {
  title: "jhosdev - Articles",
  description: "Articles Page",
};

export default function Page() {
  return (
    <>
      <TransitionEffect />
      <main className="w-full flex flex-col items-center justify-center overflow-hidden text-dark dark:text-light">
        <LayoutComponent className="pt-16">
          <AnimatedText text="Words Can Change The World!" className="mb-16" />
          <AnimatedText text="Coming Soon." className="mb-16 text-primary dark:text-primaryDark" />
        </LayoutComponent>
      </main>
    </>
  );
}

/**


          <ul className="grid grid-cols-2 gap-16">
            <FeaturedArticle
              img={article1}
              title="Build A Custom Pagination Component In Reactjs From Scratch"
              time="9 min read"
              summary="Learn how to build a custom pagination component in ReactJS from scratch. Follow this step-by-step guide to integrate Pagination component in your ReactJS project."
              link="/"
            />
            <FeaturedArticle
              img={article2}
              title="Build A Custom Pagination Component In Reactjs From Scratch"
              time="9 min read"
              summary="Learn how to build a custom pagination component in ReactJS from scratch. Follow this step-by-step guide to integrate Pagination component in your ReactJS project."
              link="/"
            />
          </ul>
          <h2 className="font0bold text-4xl w-full text-center my-16 mt-32">
            All Articles
          </h2>
          <ul>
            <Article
              title="Build A Fabulous Todo List App With React, Redux And Framer-Motion"
              date="March 22, 2023"
              img={article3}
              link="/"
            />
            <Article
              title="Redux Simplified: A Beginner's Guide For Web Developers"
              date="April 23, 2023"
              img={article4}
              link="/"
            />
          </ul>



 */


