'use client'

import { motion, useScroll } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import LiIcon from "./LiIcon";
interface SheetRow {
  id: string;
  position: string;
  company: string;
  companyLink: string;
  startDate: string;
  endDate?: string;
  location: string;
  description: string[];
  descriptionEsp: string[];
}

const Details = ({
  position,
  company,
  companyLink,
  startDate,
  endDate,
  location,
  description,
  descriptionEsp,
}: SheetRow) => {
    const ref = useRef(null);

  const endDateString = endDate ? endDate : "Present";
  return (
    <li ref={ref} className="my-8 first:mt-0 last:mb-0 w-[60%] mx-auto flex flex-col items-center justify-between">
      <LiIcon reference={ref}/>
      <motion.div initial={{y:0}} whileInView={{y:50}} transition={{duration:0.5,type:"spring"}}>
        <h3 className="capitalize font-bold text-2xl mb-2">
          {position}&nbsp;
          <a
            href={companyLink}
            target="_blank"
            className="text-primary dark:text-primaryDark capitalize"
          >
            @{company}
          </a>
        </h3>
        <span className="capitalize font-medium text-dark/75 dark:text-light/75">
          {startDate} - {endDateString} | {location}
        </span>
        <h4 className="font-semibold text-primary dark:text-primaryDark mt-2">Achievements</h4>
        <ul className="font-medium w-full mt-1">
          {description.map((task, index) => (
            <li key={index}>&#8226; {task}</li>
          ))}
        </ul>
        
      </motion.div>
    </li>
  );
};

const Experience = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center start"],
  });

  const [data, setData] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch("/api/google-sheets")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network error: " + response.status);
        }
        return response.json();
      })
      .then((json) => {
        setData(json.data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading data: {error.message}</p>;

  return (
    <div className="my-64">
      <h2 className="font-bold text-8xl mb-32 w-full text-center text-dark dark:text-light">
        Experience
      </h2>
      <div ref={ref} className="w-[75%] mx-auto relative">
        <motion.div
          className="absolute left-9 top-0 w-[4px] h-full bg-dark dark:bg-light origin-top"
          style={{ scaleY: scrollYProgress }}
        />
        <ul className="w-full flex flex-col items-start justify-between ml-4 text-dark dark:text-light">
          {data.sort((a, b) => {
            const [monthA, yearA] = a.startDate.split('/');
            const [monthB, yearB] = b.startDate.split('/');
            const dateA = new Date(Number(yearA), Number(monthA) - 1, 1);
            const dateB = new Date(Number(yearB), Number(monthB) - 1, 1);
            const dateComparison = dateB.getTime() - dateA.getTime();
            if (dateComparison !== 0) return dateComparison;

            if (!a.endDate && b.endDate) return -1;
            if (a.endDate && !b.endDate) return 1;

            return 0;
          }).map((d) => (
            <Details
              key={d.id}
              {...d}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Experience;
