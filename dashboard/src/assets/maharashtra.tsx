import React from 'react';

export default function MaharashtraOutline(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M200 200 Q 300 100 400 150 T 600 200 T 700 400 T 500 500 T 300 450 T 150 400 Z"
        stroke="#E5E7EB"
        strokeWidth="4"
        fill="#F8FAFC"
      />
    </svg>
  );
}
