'use client'

import { TagCloudOptions } from "TagCloud";
import WordCloud from "./WordCloud";


const skills = [
 {
  title: "Programming Languages",
  skills: ["Golang", "Rust", "C++", "C#", "Python", "JavaScript", "TypeScript", "Java", "Kotlin", "Dart", "Flutter"]
 },
 {
  title: "Frontend Development",
  skills: ["React", "Nextjs", "Gatsby", "Angular", "Vue", "Tailwind CSS", "Htmx"]
 },
 {
  title: "Backend Development",
  skills: ["Echo", "Gin", "Spring Boot", "Flask", "FastAPI", "Django", "Node.js", ".NET", "RESTful APIs", "GraphQL"]
 },
 {
  title: "Databases",
  skills: ["SQL", "NoSQL", "MongoDB", "DynamoDB", "Redis"]
 },
 {
  title: "Cloud Computing",
  skills: ["AWS", "Azure", "Google Cloud Platform"]
 },
 {
  title: "DevOps & CI/CD",
  skills: ["Docker", "Kubernetes", "Jenkins", "GitLab", "Azure Pipelines", "CI/CD pipelines", "Trunk-Based Development"]
 },
 {
  title: "Testing & Quality Assurance",
  skills: ["Playwright", "Cypress", "Jest", "Supertest", "Unit Testing", "Integration Testing", "End-to-End Testing"]
 },
 {
  title: "Microservices & Architecture",
  skills: ["gRPC", "Domain-Driven Design", "Design Patterns", "Service-Oriented Architecture"]
 },
 {
  title: "Mobile Development",
  skills: ["Android Studio", "React Native", "Flutter", "Expo"]
 },
 {
  title: "Other",
  skills: ["OOP", "Functional Programming", "Reactive Programming", "Test-Driven Development (TDD)", "Performance Optimization"]
 }
]

export default function Page() {
  const options: TagCloudOptions = {
    radius: 300,
    maxSpeed: 'fast',
    initSpeed: 'fast',
    keep: true
  };

  const skillsArray = skills.map(({ skills }) => skills).flat();

  return (
    <>
      <h2 className="font-bold text-8xl mt-64 w-full text-center text-dark dark:text-light">
        Skills
      </h2>

      <p className="my-4 font-medium text-dark/75 dark:text-white/75">
        My skill set covers a wide range of technologies, including:
      </p>
      
      {skills.map(({ title, skills }) => (
        <p className="my-4 font-medium text-dark/75 dark:text-white/75">
          <span className="text-primary dark:text-primaryDark font-semibold">
            {title}:
          </span>{" "}
          {skills.join(", ")}
        </p>
      ))}

      <p className="my-4 font-medium text-dark/75 dark:text-white/75">
        <span className="text-primary dark:text-primaryDark font-semibold">
          And More!
        </span>{" "}
      </p>

      {/* <WordCloud texts={skillsArray} options={options} /> */}
    </>
  );
}
