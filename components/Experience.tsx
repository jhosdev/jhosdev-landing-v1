'use client'

import { motion, useScroll } from "framer-motion";
import { useRef } from "react";
import LiIcon from "./LiIcon";

type DetailsProps = {
  position: string;
  company: string;
  companyLink: string;
  time: string;
  address: string;
  work: string;
  ach: string[];
};

const Details = ({
  position,
  company,
  companyLink,
  time,
  address,
  work,
  ach,
}: DetailsProps) => {
    const ref = useRef(null);
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
          {time} | {address}
        </span>
        <p className="font-medium w-full mt-2">{work}</p>
        <h4 className="font-semibold text-primary dark:text-primaryDark mt-2">Achievements</h4>
        <ul className="font-medium w-full mt-1">
          {ach.map(task => <li key={task}>&#8226; {task}</li>)}
        </ul>
        
      </motion.div>
    </li>
  );
};

const jobs = [
 {
  position: "Senior Software Engineer",
  company: "Turing",
  companyLink: "https://www.linkedin.com/company/turingcom/",
  time: "09/2024 - 12/2024",
  address: "Palo Alto, California, USA",
  ach: [
    "Designed and delivered high-quality serverless applications using AWS services, including Lambda, AppSync, S3, SQS, Cloudwatch and Amplify, ensuring robust infrastructure through SAM and CloudFormation. Built user-centric frontends with React and managed reliable data storage solutions with RDS and DynamoDB.",
    "Orchestrated deployments using Kubernetes with custom environments for each pull request, enabling seamless testing and faster feature delivery.",
    "Implemented comprehensive unit testing strategies in Python, achieving at least 90% test coverage to safeguard business logic and functionality during upgrades, including the migration of multiple repositories to Python 3.12.",
    "Mentored developers to adopt best practices in coding and test writing, fostering a culture of quality and reliability.",
    "Automated test workflows using Rust & Golang scripts, accelerating local execution and ensuring efficient validation of business logic across environments."
  ]
 },
 {
  position: "Semi-senior Software Developer",
  company: "Laureate Education",
  companyLink: "https://www.linkedin.com/company/laureate-education/",
  time: "11/2023 - 09/2024",
  address: "Lima, Peru",
  ach: [
    "Participated in the development team of the student portal backend microservices app at Universidad Peruana de Ciencias Aplicadas, using technologies such as FastAPI, Django, Python, AWS Serverless, and Directus. Then implemented caching using DynamoDB",
    "Participated in the development team of the student portal frontend at Universidad Peruana de Ciencias Aplicadas, using technologies such as VueJS, Nuxt and Pinia.",
    "Developed a high-performance backend application using Golang and the Echo framework, serving as an additional layer to transform data from third-party services, significantly improving data processing speed by 40%.",
    "Managed applications using EC2, S3, RDS and Cloudwatch.",
    "Implemented CI/CD pipelines using Azure Pipelines.",
    "Conducted thorough testing, including unit tests and integration tests, to ensure high-quality deliverables."
  ]
 },
 {
  position: "Software Engineer, Contract",
  company: "trades.org",
  companyLink: "https://www.linkedin.com/company/trades-org/",
  time: "07/2023 - 01/2024",
  address: "Austin, Texas, USA",
  ach: [
    "Formed part of the design and development of multiple enterprise-level microservice applications of the company using AWS services like API Gateway, Amplify, Lambda and SQS with Typescript, Nestjs, GraphQL and Apollo Federation.",
    "Designed and implemented multiple frontend and mobile applications using React, React Native, Astro and NextJS.",
    "I was part of the development team to build an application using OpenAI API to build websites and developed custom agents to facilitate the website creation experience.",
    "Developed a back office application to manage organizations settings and custom workflows using Nextjs with Django and Graphene, improving the development process by 20%",
    "Developed utility tools and scripts using Golang to enhance project workflow, including: automatic folder structure generation for new microservices and frontend projects, CLI tools for db migrations and seeding, data processing and transformation utilities for large datasets.",
    "Automated the backend testing process by integrating Jest and SuperTest to handle Integration and End-to-End tests.",
    "Continuous Integration/Deployment Pipeline Integration, pull requests, code reviews, load/stress testing, unit/integration/e2e testing"
  ]
 },
 {
  position: "Software Developer, Contract",
  company: "Paqtana",
  companyLink: "https://www.linkedin.com/company/paqtana/",
  time: "06/2023 - 08/2023",
  address: "London, England, UK",
  ach: [
    "Designed and implemented functionalities in the company’s applications using React, Python, Flask, Django, SQLAlchemy, PostgreSQL and Google Cloud Platform. Implemented caching in the Django application improving performance by 30%.",
    "Engineering owner of the E2E experience of the platform’s frontend ecosystem, improving the overall functionality and development cycle of the application using Playwright.",
    "Updated and migrated the libraries and packages of both frontend and backend projects.",
    "Continuous Integration/Deployment Pipeline Integration, pull requests, code reviews, load/stress testing, unit/integration/e2e testing"
  ]
 },
 {
  position: "Software Developer",
  company: "Waytech Peru",
  companyLink: "https://www.linkedin.com/company/way-tech/",
  time: "05/2023 - 08/2023",
  address: "Lima, Peru",
  ach: [
    "Led the migration, design and development of the company application using React, .NET, Express, DevExpress, AWS, DynamoDB and Maria DB, improving the previous ASP.NET system performance by 50%.",
    "Designed and improved the core business operations, particularly in the area of production, by effectively managing production processes through the implementation of the reliable floor control system (SCP).",
    "Conducted regular performance analysis and implemented optimizations to enhance application efficiency.",
    "Continuous Integration/Deployment Pipeline Integration, pull requests, code reviews, load/stress testing, unit/integration/e2e testing"
  ]
 },
 {
  position: "Software Developer",
  company: "Itali Peru",
  companyLink: "https://www.facebook.com/institutoitali",
  time: "01/2023 - 04/2023",
  address: "Cusco, Peru",
  ach: [
    "Developed a comprehensive internal database application for a school company using the MERN stack (MongoDB, Express.js, React, Node.js) with a focus on Typescript. The application was created to efficiently manage student data, course schedules, and teacher information, among other essential functions.",
    "Developed an ecommerce application using Next.js and Tailwind, providing a user-friendly platform for selling a diverse range of courses and offerings. The application served as a seamless marketplace, allowing customers to explore and access a wide array of company-provided products and services, all within a convenient and intuitive online environment.",
    "Collaborated closely with the client to gain a deep understanding of their specific requirements and successfully delivered a functional and user-friendly interface that precisely catered to their needs.",
    "Designed and developed the database architecture, ensuring that it was scalable, secure, and optimized for performance.",
    "Developed the internal application front-end using React with TypeScript, leveraging PrimeReact and TailwindCSS libraries. Implemented essential features such as login and CRUD functionalities, cookie-based authentication, restricted routes with different access levels for admin, employees, and students, and ensured responsive design for seamless user experience",
    "Developed a REST API using Node.js and Express.js with TypeScript to handle HTTP requests and responses on the server-side. Implemented middleware for various functionalities, including user authentication, data filtering, and real-time data updates using JWT (JSON Web Tokens) in combination with MongoDB and Express",
    "Developed the ecommerce application using Next.js and Tailwind, integrating it with the Paypal API for the payments in the app",
    "Conducted testing and debugging to identify and fix any issues and ensured that the application was fully functional and bug-free.",
    "Provided ongoing maintenance and support for the application, ensuring that it remained up-to-date with the latest security patches and bug fixes."
  ]
 }
]

const Experience = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center start"],
  });

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
          {jobs.map((job) => (
            <Details
              key={job.position}
              work=""
              {...job}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Experience;
