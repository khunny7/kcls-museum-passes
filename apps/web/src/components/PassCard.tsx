interface Pass {
  id: string
  name: string
  description: string
  imageUrl?: string
  available: boolean
}

interface PassCardProps {
  pass: Pass
}

export function PassCard({ pass }: PassCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer">
      <div className="aspect-w-16 aspect-h-9">
        {pass.imageUrl ? (
          <img
            src={pass.imageUrl}
            alt={pass.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
            <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{pass.name}</h3>
        <p className="text-gray-600 mb-4 line-clamp-3">{pass.description}</p>
        
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            pass.available 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {pass.available ? 'Available' : 'Unavailable'}
          </span>
          
          <span className="text-blue-600 font-medium hover:text-blue-800">
            View Details →
          </span>
        </div>
      </div>
    </div>
  )
}