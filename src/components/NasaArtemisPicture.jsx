import { useState, useEffect } from 'react'

function NasaArtemisPicture() {
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchArtemisImage = async () => {
      try {
        // NASA APOD API endpoint - using Artemis-related search
        // We'll fetch the media from NASA's API and pick a random one
        const response = await fetch(
          'https://images-api.nasa.gov/search?q=artemis&media_type=image&page_size=50'
        )
        const data = await response.json()
        
        if (data.collection && data.collection.items.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.collection.items.length)
          const selected = data.collection.items[randomIndex]
          
          // Get the image URL from the links
          if (selected.links && selected.links.length > 0) {
            const imageUrl = selected.links[0].href
            setImage(imageUrl)
          }
        }
        setLoading(false)
      } catch (err) {
        setError('Failed to load Artemis image')
        setLoading(false)
      }
    }

    fetchArtemisImage()
  }, [])

  if (loading) {
    return (
      <div className="absolute inset-0 bg-black text-white flex items-center justify-center font-mono">
        <div className="text-center">
          <p className="text-lg tracking-widest opacity-60">Loading Artemis mission photo...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute inset-0 bg-black text-white flex items-center justify-center font-mono">
        <div className="text-center">
          <p className="text-lg tracking-widest opacity-60">{error}</p>
          <p className="text-sm mt-4 opacity-40">Try refreshing for another picture</p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-black text-white flex flex-col items-center justify-center font-mono">
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-2xl tracking-widest opacity-60">TODAY'S ARTemis PICTURE</h1>
        <p className="text-sm tracking-wide opacity-40">
          NASA Artemis Mission Photo
        </p>
      </div>
      
      <div className="max-w-4xl max-h-[70vh] p-4">
        <img 
          src={image} 
          alt="NASA Artemis Mission Photo"
          className="max-w-full max-h-full object-contain rounded border border-white/20"
        />
      </div>
      
      <div className="mt-8 text-center">
        <a 
          href="/random"
          className="text-sm opacity-60 hover:opacity-100 transition-opacity duration-300 tracking-wide"
        >
          Back to home
        </a>
      </div>
    </div>
  )
}

export default NasaArtemisPicture
