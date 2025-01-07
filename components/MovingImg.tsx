'use client'

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue } from "framer-motion";

type MovingImgProps = {
    img:any;
    title:string;
    link:string;
}

export const FramerImage = motion(Image);

export const MovingImg = ({ img, title, link }: MovingImgProps) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const imgRef = useRef<HTMLImageElement>(null);
  
    function handleMouse(event: React.MouseEvent) {
      imgRef.current!.style.display = "inline-block";
      x.set(event.pageX);
      y.set(-10);
    }
  
    function handleMouseLeave(event: React.MouseEvent) {
      imgRef.current!.style.display = "none";
      x.set(0);
      y.set(0);
    }
  
    return (
      <Link
        href={link}
        target="_blank"
        onMouseMove={handleMouse}
        onMouseLeave={handleMouseLeave}
      >
        <h2 className="capitalize text-xl font-semibold hover:underline">
          {title}
        </h2>
        <FramerImage
          ref={imgRef}
          src={img}
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 50vw"
          alt={title}
          className="z-10 w-96 h-auto hidden absolute rounded-lg"
          style={{ x: x, y: y }}
        />
      </Link>
    );
  };