import AnimatedText from "@components/AnimatedText";
import LayoutComponent from "@components/LayoutComponent";

import TransitionEffect from "@components/transitionEffect";
import { FeaturedProject, Project } from "@components/ProjectElements";

import { fetchSheetMap } from "@utils/googleSheets";

interface ProjectData {
  id: string;
  project: string;
  link: string;
  github: string;
  type: string;
  image: string;
  summary: string[];
}
export const metadata = {
  title: "jhosdev - Projects",
  description: "Projects Page",
};

export default async function Page() {
  const projectsMap = await fetchSheetMap<ProjectData, "project", "link">(
    "projects",
    "project",
    "link",
  );
  return (
    <>
      <TransitionEffect />
      <main>
        <div className="w-full flex flex-col items-center justify-center">
          <LayoutComponent className="pt-16 min-h-[90vh]">
            <AnimatedText
              text="Imagination Trumps Knowledge!"
              className="mb-16"
            />
            {
              Object.keys(projectsMap).length === 0 ? (
                <AnimatedText text="Update in progress... Check back soon!" className="mb-16 text-primary dark:text-primaryDark" />
              ) : (
                <div className="grid grid-cols-12 gap-24 gap-y-32">
                  {Object.entries(projectsMap).map(([key, project]) => (
                    <div key={project.id} className="col-span-12">
                      <FeaturedProject
                        title={key}
                        img={"https://lh3.googleusercontent.com/d/1_cE1vDCrz6qahOFZGuk8tecBAmFKiswK=w1000"}
                        link={project.default}
                        github={project.github}
                        type={project.type}
                        summary={project.summary}
                      />
                    </div>
                  ))}
                </div>
              )
            }
          </LayoutComponent>
        </div>
      </main>
    </>
  );
}
