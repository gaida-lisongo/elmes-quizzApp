import { Testimonial } from "@/types/testimonial";
import Image from "next/image";

const SingleTestimonial = ({ review, onClick }: { review: Testimonial; onClick?: () => void }) => {
  const { name, designation, image, content } = review;
  const contentNode = (
    <>
      <div className="mb-7.5 flex justify-between border-b border-stroke pb-6 dark:border-strokedark">
        <div>
          <h3 className="mb-1.5 text-metatitle3 text-black dark:text-white">
            {name}
          </h3>
          <p>{designation}</p>
        </div>
        <Image width={60} height={50} className="" src={image} alt={name} />
      </div>

      <p>{content}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-lg bg-white p-9 pt-7.5 text-left shadow-solid-9 transition hover:-translate-y-1 hover:border-primary hover:shadow-solid-4 dark:border dark:border-strokedark dark:bg-blacksection dark:shadow-none"
      >
        {contentNode}
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-white p-9 pt-7.5 shadow-solid-9 dark:border dark:border-strokedark dark:bg-blacksection dark:shadow-none">
      {contentNode}
    </div>
  );
};

export default SingleTestimonial;
