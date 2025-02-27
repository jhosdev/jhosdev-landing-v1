type PropsLayout = {
  children: React.ReactNode;
  className?: string;
};

const LayoutComponent = ({ children, className = "" }: PropsLayout) => {
  return (
    <div
      className={`w-full h-full inline-block z-0 bg-light dark:bg-dark p-32 ${className}`}
    >
      {children}
    </div>
  );
};

export default LayoutComponent;
