import AnimatedText from "@components/AnimatedText";
import { Article } from "@components/ArticleElements";
import LayoutComponent from "@components/LayoutComponent";

import TransitionEffect from "@components/transitionEffect";

import { fetchSheetMap } from "@utils/googleSheets";

interface ArticleData {
  id: string;
  title: string;
  link: string;
  date: string;
  image: string;
}

export const metadata = {
  title: "jhosdev - Articles",
  description: "Articles Page",
};

export default async function Page() {
  const articlesMap = await fetchSheetMap<ArticleData, "title", "link">(
    "articles",
    "title",
    "link",
  );
  return (
    <>
      <TransitionEffect />
      <main className="w-full flex flex-col items-center justify-center overflow-hidden text-dark dark:text-light">
        <LayoutComponent className="pt-16 min-h-[90vh]">
          <AnimatedText text="Words Can Change The World!" className="mb-16" />
          {
            Object.keys(articlesMap).length === 0 ? (
              <AnimatedText text="Update in progress... Check back soon!" className="mb-16 text-primary dark:text-primaryDark" />
            ) : (
              <ul className="grid grid-cols-2 gap-16">
                {Object.entries(articlesMap).map(([key, article]) => (
                  <li key={article.id}>
                    <Article
                      title={key}
                      date={article.date}
                      img={article.image}
                      link={article.default}
                    />
                  </li>
                ))}
              </ul>
            )
          }
        </LayoutComponent>
      </main>
    </>
  );
}

/**
 * For future reference
            <FeaturedArticle
              img={article2}
              title="Build A Custom Pagination Component In Reactjs From Scratch"
              time="9 min read"
              summary="Learn how to build a custom pagination component in ReactJS from scratch. Follow this step-by-step guide to integrate Pagination component in your ReactJS project."
              link="/"
            />
            <Article
              title="Build A Fabulous Todo List App With React, Redux And Framer-Motion"
              date="March 22, 2023"
              img={article3}
              link="/"
            />
 */
