import { MapPin } from 'lucide-react'
import { cn } from '../../../lib/cn'

/**
 * VendorMap Component
 * Displays vendor location on a map
 * For now, uses a static map image. Can be replaced with Google Maps, Mapbox, etc.
 */
export function VendorMap({ vendor, className }) {
  const { location, region, name, coverageRadius, serviceArea, coverageConflicts } = vendor || {}
  
  // If we have lat/lng, we can use Google Maps Static API or similar
  // For now, we'll show a placeholder with region info
  const mapUrl = location?.lat && location?.lng
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=12&size=600x300&markers=color:red%7C${location.lat},${location.lng}&key=YOUR_API_KEY`
    : null

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100', className)}>
      {mapUrl ? (
        <img
          src={mapUrl}
          alt={`${name} location`}
          className="h-full w-full object-cover"
          onError={(e) => {
            // Fallback if map fails to load
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
      ) : null}
      <div
        className={cn(
          'flex h-full min-h-[200px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 text-center',
          mapUrl && 'hidden',
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
          <MapPin className="h-8 w-8" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-bold text-gray-900">{name || 'Vendor Location'}</p>
          <p className="text-xs text-gray-600">{region || 'Location not available'}</p>
          {location?.lat && location?.lng ? (
            <p className="text-xs text-gray-500">
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </p>
          ) : (
            <p className="text-xs text-gray-500">Geo coordinates missing</p>
          )}
          <p className="text-xs text-gray-600">
            Coverage Radius: {coverageRadius ? `${coverageRadius} km` : 'N/A'}
          </p>
          {serviceArea && <p className="text-[0.7rem] text-gray-500">{serviceArea}</p>}
          {coverageConflicts?.length ? (
            <p className="text-xs font-semibold text-red-600">
              Overlaps with{' '}
              {coverageConflicts
                .map((conflict) =>
                  conflict.vendorA.id === vendor.id ? conflict.vendorB.name : conflict.vendorA.name,
                )
                .join(', ')}
            </p>
          ) : (
            <p className="text-xs font-semibold text-[#017827]">No overlap detected</p>
          )}
        </div>
      </div>
    </div>
  )
}

