import Link from "next/link";
import Image from "next/image";
import pic from "@public/images/404-error.png";

//TODO: Fix Link Error, using anchor tag for now
export default function NotFound() {
  return (
    <>
      <div className="bg-light text-dark dark:bg-dark dark:text-light min-h-screen">
        <div className="flex flex-col w-max mx-auto text-center mb-2">
          <Image
            src={pic}
            alt="404 error image"
            width={400}
            height={250}
            className="h-auto w-72 xs:w-80 md:w-96"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
        <div className="flex flex-col text-center">
          <h1 className="text-5xl mt-8 mb-6">404</h1>
          <p>The page you are looking for does not exist.</p>
          <div className="bg-foreground-light dark:bg-foreground-dark h-0.5 opacity-10 w-60 xs:w-96 mx-auto my-8" />
          <button className="mx-auto py-2 w-40 rounded-md hover:opacity-90 font-medium bg-blue-700 dark:bg-blue-300 text-light dark:text-dark mb-12">
            <a href="">Return to home</a>
          </button>
        </div>
      </div>
    </>
  );
}
