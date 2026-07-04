"use client";

import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  text?: string;
  href?: string;
  className?: string;
}

const Logo = ({ text, href = "/", className = "" }: LogoProps) => {
  return (
    <Link href={href} className={`inline-flex flex-col ${className}`}>
      <div className="flex h-20 w-20 overflow-hidden p-1">
        <div className="relative h-full w-full">
          <Image
            src="/images/logo/logo.png"
            alt="ELMES-QUIZ"
            width={80}
            height={80}
            className="rounded-full "
          />
        </div>
      </div>
      {text && (
        <p className="mb-10 mt-5">
          {text}
        </p>
      )}
    </Link>
  );
};

export default Logo;