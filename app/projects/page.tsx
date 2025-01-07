import AnimatedText from "@components/AnimatedText";
import LayoutComponent from "@components/LayoutComponent";
import postsapp from "@public/images/projects/posts-app.png";
import pokeswapapp from "@public/images/projects/pokeswap-app.png";
import tramigoapp from "@public/images/projects/tramigo-app.png";
import offersapp from "@public/images/projects/offers-app.png";
import cocktailsapp from "@public/images/projects/cocktails-app.png";
import TransitionEffect from "@components/transitionEffect";
import { FeaturedProject, Project } from "@components/ProjectElements";
export const metadata = {
  title: "jhosdev - Projects",
  description: "Projects Page",
};



export default function Page() {
  return (
    <>
        <TransitionEffect />
        <main>
          <div className="w-full flex flex-col items-center justify-center">
            <LayoutComponent className="pt-16">
              <AnimatedText
                text="Imagination Trumps Knowledge!"
                className="mb-16"
              />
              <div className="grid grid-cols-12 gap-24 gap-y-32">
                <div className="col-span-12 ">
                  <FeaturedProject
                    title="Post CRUD Application"
                    img={postsapp}
                    summary={[
                      "A entry-level app using TypeScript, Vue 3, Vue Router, Vue-i18n and PrimeVue using a fake api (jsonplaceholder). The app is hosted on Firebase, ensuring seamless accessibility and scalability.",
                      "It provides full CRUD implementations and has more features in its way, like: User login & authentication in the User Tab, API Tracking with comprehensive documentation in the Documentation Tab, Comments section for posts data, integration with a real API and Dark Mode & Animations in the Settings Tab.",
                    ]}
                    link="https://posts-app-3ef83.web.app/"
                    github="https://github.com/jhosdev/posts-app"
                    type="Featured Project - In Development"
                  />
                </div>
                <div className="col-span-12 ">
                  <FeaturedProject
                    title="PokeSwap - App"
                    img={pokeswapapp}
                    summary={[
                      "This is the initial version of a trading application built using TypeScript, Angular, Angular Router, RxJs, and Angular Material, and it currently utilizes a fake API (jsonwebserver). The app is hosted on Firebase, ensuring seamless accessibility and scalability",
                      "While this is an entry-level version, the app already includes basic trading capabilities and user authentication, with upcoming plans to introduce more advanced functionalities and integration with a real API in the coming weeks. Additionally, the app will feature enhanced user experience through intuitive design, dark mode, and animations. Stay tuned for more updates and features!",
                    ]}
                    link="https://curious-peony-d47fe2.netlify.app/"
                    github="https://github.com/OpenFinance-upc-pre-202301-si729-sw53/PokeSwap-Frontend"
                    type="Featured Project - In Development"
                  />
                </div>
                <div className="col-span-12 ">
                  <FeaturedProject
                    title="Tramigo - App"
                    img={tramigoapp}
                    summary={[
                      "This is the initial version of a users procedure management application built using JavaScript, Vue 3, Vue Router, Axios, Vue-i18n and PrimeVue using a fake api (jsonwebserver). The app is hosted on Netlify, ensuring full accessibility.",
                      "The app currently offers user registration and authentication, and will be further developed to include enhanced design, real API integration, full control and management of user procedures, and potentially establishing connections with other companies.",
                    ]}
                    link="https://tramigo-88245.web.app/"
                    github="https://github.com/FastDocs-upc-pre-202301-si730-sw53/tramigo-frontend"
                    type="Featured Project - In Development"
                  />
                </div>
                <div className="col-span-6">
                  <Project
                    title="Cocktails API Application - Angular + Angular Material"
                    img={cocktailsapp}
                    link="https://github.com/jhosdev/cocktails-app"
                    github="https://github.com/jhosdev/cocktails-app"
                    type="Featured Project - Code Only"
                  />
                </div>
                <div className="col-span-6">
                  <Project
                    title="Offers CRUD Application - Angular + Angular Material"
                    img={offersapp}
                    link="https://github.com/jhosdev/offers-app"
                    github="https://github.com/jhosdev/offers-app"
                    type="Featured Project - Code Only"
                  />
                </div>
              </div>
            </LayoutComponent>
          </div>
        </main>
    </>
  );
}
