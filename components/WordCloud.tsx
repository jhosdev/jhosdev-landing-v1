'use client'

import React, { useEffect, useRef } from "react";
import TagCloud, { TagCloudOptions } from "TagCloud";

const WordCloud = ({
    containerId = 'tag-cloud',
    texts,
    options
}: {
    containerId?: string;
    texts: string[];
    options: TagCloudOptions;
}) => {
    const containerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            TagCloud(containerRef.current, texts, options);
        }
    }, [0]);

    return (
        <div className='main w-full h-[600px] max-h-[600px]'>
            <span id={containerId} ref={containerRef} className="content h-[600px] max-h-[600px]"></span>
        </div>
    );
}

export default WordCloud;