import Image from 'next/image'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-950 z-50">
      <div className="animate-bounce">
        <Image src="/FindTheVet.png" alt="FindTheVet" width={200} height={70} className="h-12 w-auto" priority />
      </div>
      <div className="flex gap-1.5 mt-6">
        <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-primary-600 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}
