(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-LAND-ID u101)
(define-constant ERR-INVALID-FARMER u102)
(define-constant ERR-INVALID-DURATION u103)
(define-constant ERR-INVALID-RENT-AMOUNT u104)
(define-constant ERR-INVALID-PAYMENT-FREQUENCY u105)
(define-constant ERR-INVALID-CROP-SHARE u106)
(define-constant ERR-LEASE-ALREADY-EXISTS u107)
(define-constant ERR-LEASE-NOT-FOUND u108)
(define-constant ERR-INVALID-START-BLOCK u109)
(define-constant ERR-LEASE-EXPIRED u110)
(define-constant ERR-LEASE-NOT-ACTIVE u111)
(define-constant ERR-INVALID-UPDATE-PARAM u112)
(define-constant ERR-MAX-LEASES-EXCEEDED u113)
(define-constant ERR-INVALID-CROP-TYPE u114)
(define-constant ERR-INVALID-TERMINATION-FEE u115)
(define-constant ERR-INVALID-GRACE-PERIOD u116)
(define-constant ERR-INVALID-LOCATION u117)
(define-constant ERR-INVALID-CURRENCY u118)
(define-constant ERR-INVALID-STATUS u119)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u120)
(define-constant ERR-INVALID-MIN-RENT u121)
(define-constant ERR-INVALID-MAX-DURATION u122)
(define-constant ERR-UPDATE-NOT-ALLOWED u123)

(define-data-var next-lease-id uint u0)
(define-data-var max-leases uint u1000)
(define-data-var creation-fee uint u1000)
(define-data-var authority-contract (optional principal) none)

(define-map leases
  uint
  {
    land-id: uint,
    landowner: principal,
    farmer: principal,
    start-block: uint,
    duration: uint,
    rent-amount: uint,
    payment-frequency: uint,
    crop-share-percentage: uint,
    crop-type: (string-utf8 50),
    termination-fee: uint,
    grace-period: uint,
    location: (string-utf8 100),
    currency: (string-utf8 20),
    is-active: bool,
    min-rent: uint,
    max-duration: uint
  }
)

(define-map leases-by-land-id
  uint
  uint
)

(define-map lease-updates
  uint
  {
    update-duration: uint,
    update-rent-amount: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-lease (id uint))
  (map-get? leases id)
)

(define-read-only (get-lease-updates (id uint))
  (map-get? lease-updates id)
)

(define-read-only (is-lease-active (land-id uint))
  (is-some (map-get? leases-by-land-id land-id))
)

(define-private (validate-land-id (land uint))
  (if (> land u0)
      (ok true)
      (err ERR-INVALID-LAND-ID))
)

(define-private (validate-farmer (farmer principal))
  (if (not (is-eq farmer tx-sender))
      (ok true)
      (err ERR-INVALID-FARMER))
)

(define-private (validate-duration (dur uint))
  (if (and (> dur u0) (<= dur u52560))
      (ok true)
      (err ERR-INVALID-DURATION))
)

(define-private (validate-rent-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-RENT-AMOUNT))
)

(define-private (validate-payment-frequency (freq uint))
  (if (> freq u0)
      (ok true)
      (err ERR-INVALID-PAYMENT-FREQUENCY))
)

(define-private (validate-crop-share (share uint))
  (if (<= share u100)
      (ok true)
      (err ERR-INVALID-CROP-SHARE))
)

(define-private (validate-crop-type (ctype (string-utf8 50)))
  (if (or (is-eq ctype "wheat") (is-eq ctype "corn") (is-eq ctype "soybean"))
      (ok true)
      (err ERR-INVALID-CROP-TYPE))
)

(define-private (validate-termination-fee (fee uint))
  (if (>= fee u0)
      (ok true)
      (err ERR-INVALID-TERMINATION-FEE))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-rent (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-RENT))
)

(define-private (validate-max-duration (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-DURATION))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-leases (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-LEASES-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-leases new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (create-lease
  (land-id uint)
  (farmer principal)
  (duration uint)
  (rent-amount uint)
  (payment-frequency uint)
  (crop-share-percentage uint)
  (crop-type (string-utf8 50))
  (termination-fee uint)
  (grace-period uint)
  (location (string-utf8 100))
  (currency (string-utf8 20))
  (min-rent uint)
  (max-duration uint)
)
  (let (
        (next-id (var-get next-lease-id))
        (current-max (var-get max-leases))
        (authority (var-get authority-contract))
        (start-block block-height)
      )
    (asserts! (< next-id current-max) (err ERR-MAX-LEASES-EXCEEDED))
    (try! (validate-land-id land-id))
    (try! (validate-farmer farmer))
    (try! (validate-duration duration))
    (try! (validate-rent-amount rent-amount))
    (try! (validate-payment-frequency payment-frequency))
    (try! (validate-crop-share crop-share-percentage))
    (try! (validate-crop-type crop-type))
    (try! (validate-termination-fee termination-fee))
    (try! (validate-grace-period grace-period))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-min-rent min-rent))
    (try! (validate-max-duration max-duration))
    (asserts! (is-none (map-get? leases-by-land-id land-id)) (err ERR-LEASE-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set leases next-id
      {
        land-id: land-id,
        landowner: tx-sender,
        farmer: farmer,
        start-block: start-block,
        duration: duration,
        rent-amount: rent-amount,
        payment-frequency: payment-frequency,
        crop-share-percentage: crop-share-percentage,
        crop-type: crop-type,
        termination-fee: termination-fee,
        grace-period: grace-period,
        location: location,
        currency: currency,
        is-active: true,
        min-rent: min-rent,
        max-duration: max-duration
      }
    )
    (map-set leases-by-land-id land-id next-id)
    (var-set next-lease-id (+ next-id u1))
    (print { event: "lease-created", id: next-id })
    (ok next-id)
  )
)

(define-public (update-lease
  (lease-id uint)
  (update-duration uint)
  (update-rent-amount uint)
)
  (let ((lease (map-get? leases lease-id)))
    (match lease
      l
        (begin
          (asserts! (is-eq (get landowner l) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-duration update-duration))
          (try! (validate-rent-amount update-rent-amount))
          (map-set leases lease-id
            {
              land-id: (get land-id l),
              landowner: (get landowner l),
              farmer: (get farmer l),
              start-block: (get start-block l),
              duration: update-duration,
              rent-amount: update-rent-amount,
              payment-frequency: (get payment-frequency l),
              crop-share-percentage: (get crop-share-percentage l),
              crop-type: (get crop-type l),
              termination-fee: (get termination-fee l),
              grace-period: (get grace-period l),
              location: (get location l),
              currency: (get currency l),
              is-active: (get is-active l),
              min-rent: (get min-rent l),
              max-duration: (get max-duration l)
            }
          )
          (map-set lease-updates lease-id
            {
              update-duration: update-duration,
              update-rent-amount: update-rent-amount,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "lease-updated", id: lease-id })
          (ok true)
        )
      (err ERR-LEASE-NOT-FOUND)
    )
  )
)

(define-public (terminate-lease (lease-id uint))
  (let ((lease (map-get? leases lease-id)))
    (match lease
      l
        (begin
          (asserts! (or (is-eq (get landowner l) tx-sender) (is-eq (get farmer l) tx-sender)) (err ERR-NOT-AUTHORIZED))
          (asserts! (get is-active l) (err ERR-LEASE-NOT-ACTIVE))
          (asserts! (>= block-height (+ (get start-block l) (get duration l))) (err ERR-LEASE-NOT-EXPIRED))
          (map-set leases lease-id (merge l { is-active: false }))
          (map-delete leases-by-land-id (get land-id l))
          (print { event: "lease-terminated", id: lease-id })
          (ok true)
        )
      (err ERR-LEASE-NOT-FOUND)
    )
  )
)

(define-public (get-lease-count)
  (ok (var-get next-lease-id))
)

(define-public (check-lease-existence (land-id uint))
  (ok (is-lease-active land-id))
)