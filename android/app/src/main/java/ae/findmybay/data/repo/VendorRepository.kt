package ae.findmybay.data.repo

import ae.findmybay.data.api.VendorApi
import ae.findmybay.domain.model.AvailabilityResponse
import ae.findmybay.domain.model.Bay
import ae.findmybay.domain.model.Service
import ae.findmybay.domain.model.Slot
import ae.findmybay.domain.model.Vendor
import ae.findmybay.domain.model.VendorDetail
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VendorRepository @Inject constructor(
    private val api: VendorApi,
) {
    suspend fun nearby(lat: Double, lng: Double, radiusMeters: Int = 15_000): List<Vendor> =
        api.nearby(lat = lat, lng = lng, radiusMeters = radiusMeters).items.map {
            Vendor(
                id = it.id,
                brandName = it.brandName,
                city = it.city,
                emirate = it.emirate,
                lat = it.lat,
                lng = it.lng,
                distanceMeters = it.distanceMeters,
                freeBays = it.freeBays,
                rating = it.rating,
                priceFromAed = it.priceFromAed,
                logoUrl = it.logoUrl,
            )
        }

    suspend fun detail(id: String): VendorDetail = api.detail(id).let {
        VendorDetail(
            id = it.id,
            brandName = it.brandName,
            city = it.city,
            emirate = it.emirate,
            addressLine = it.addressLine,
            lat = it.lat,
            lng = it.lng,
            rating = it.rating,
            priceFromAed = it.priceFromAed,
            logoUrl = it.logoUrl,
            services = it.services.map { s ->
                Service(s.id, s.name, s.durationMin, s.priceAed, s.vatInclusive)
            },
            bays = it.bays.map { b -> Bay(b.id, b.name, b.bayType, b.status) },
        )
    }

    suspend fun availability(vendorId: String, serviceId: String, date: String): AvailabilityResponse =
        api.availability(vendorId, serviceId, date).let {
            AvailabilityResponse(
                serviceId = it.serviceId,
                serviceName = it.serviceName,
                durationMin = it.durationMin,
                date = it.date,
                slots = it.slots.map { s -> Slot(s.startsAt, s.endsAt, s.available) },
            )
        }
}
