'use client'
import { FramerImage, MovingImg } from "@components/MovingImg";
import { motion } from "framer-motion";
import Link from "next/link";

type ArticleProps = {
    img: any;
    title: string;
    time: string;
    date: string;
    summary?: string;
    link: string;
  };
  
  export const Article = ({ img, title, date, link }: ArticleProps) => {
    return (
      <motion.li
        className="relative w-full p-4 py-6 my-4 rounded-xl flex items-center justify-between bg-light text-dark dark:bg-dark dark:text-light first:mt-0 border border-solid border-dark dark:border-light border-r-4 border-b-4"
        initial={{ y: 200 }}
        whileInView={{ y: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
        viewport={{ once: true }}
      >
        <MovingImg title={title} img={img} link={link} />
        <span className="text-primary dark:text-primaryDark font-semibold pl-4">
          {date}
        </span>
      </motion.li>
    );
  };
  
  export const FeaturedArticle = ({ img, title, time, summary, link }: ArticleProps) => {
    return (
      <li className="relative col-span-1 w-full p-4 bg-light border border-solid dark:bg-dark dark:border-light border-dark rounded-2xl">
        <div className="absolute top-0 -right-3 -z-10 w-[101%] h-[103%] rounded-[2.5rem] bg-dark dark:bg-light rounded-br-3xl" />
        <Link
          href={link}
          target="_blank"
          className="w-full inline-block cursor-pointer overflow-hidden rounded-lg"
        >
          <FramerImage
            src={img}
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 50vw"
            alt={title}
            className="w-full h-auto"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          />
        </Link>
        <Link href={link} target="_blank">
          <h2 className="capitalize text-2xl font-bold my-2 mt-4 hover:underline">
            {title}
          </h2>
        </Link>
        <p className="text-sm mb-2">{summary}</p>
        <span className="text-primary dark:text-primaryDark font-semibold">
          {time}
        </span>
      </li>
    );
  };