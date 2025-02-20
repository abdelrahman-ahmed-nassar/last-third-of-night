// Key for storing location in localStorage
const LOCATION_STORAGE_KEY = "prayerTimesLocation";

// Main function to initialize the app
function initApp() {
  document.getElementById("prayer-times").innerHTML =
    '<div class="loading">جاري حساب أوقات الصلاة...</div>';
  document.getElementById("last-third").innerHTML =
    "جاري حساب الثلث الأخير من الليل...";

  // Check if we have saved location
  const savedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);

  if (savedLocation) {
    // Use saved location
    const locationData = JSON.parse(savedLocation);
    if (locationData.lat && locationData.lng) {
      console.log("Using saved location");
      useLocation(
        locationData.lat,
        locationData.lng,
        locationData.country,
        locationData.city
      );
      return;
    }
  }

  // Get user's current location if not saved
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      handleLocation,
      handleLocationError
    );
  } else {
    showError("متصفحك لا يدعم خدمة تحديد الموقع.");
  }
}

// Handle successful location retrieval
function handleLocation(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;

  // Get country name from coordinates using reverse geocoding
  getCountryName(lat, lng);
}

// Get country name using reverse geocoding
function getCountryName(lat, lng) {
  fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=ar`
  )
    .then((response) => response.json())
    .then((data) => {
      let country = data.address.country || "غير معروف";
      let city =
        data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.state ||
        "";

      // Save location to localStorage
      const locationData = {
        lat: lat,
        lng: lng,
        country: country,
        city: city,
        timestamp: new Date().getTime(),
      };
      localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify(locationData)
      );

      // Use the location
      useLocation(lat, lng, country, city);
    })
    .catch((error) => {
      console.error("Error getting location name:", error);
      useLocation(lat, lng, "تم تحديد الموقع", "");
    });
}

// Use location data to get prayer times
function useLocation(lat, lng, country, city) {
  // Display location
  document.getElementById("location").innerHTML = `
          <strong>موقعك:</strong> ${city ? city + "، " : ""}${country}<br>
          <strong>التوقيت المحلي:</strong> ${new Date().toLocaleString(
            "ar-SA"
          )}
          <div style="text-align: center; margin-top: 10px;">
              <button class="btn" onclick="resetLocation()">تحديث الموقع</button>
          </div>
      `;

  // Get timezone and prayer times
  getPrayerTimes(lat, lng);
}

// Reset saved location
function resetLocation() {
  localStorage.removeItem(LOCATION_STORAGE_KEY);
  document.getElementById("location").innerHTML = "جاري تحديد موقعك...";
  document.getElementById("prayer-times").innerHTML =
    '<div class="loading">جاري حساب أوقات الصلاة...</div>';
  document.getElementById("last-third").innerHTML =
    "جاري حساب الثلث الأخير من الليل...";

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      handleLocation,
      handleLocationError
    );
  } else {
    showError("متصفحك لا يدعم خدمة تحديد الموقع.");
  }
}

// Handle geolocation errors
function handleLocationError(error) {
  let errorMessage = "خطأ غير معروف";
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = "تم رفض طلب تحديد الموقع.";
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = "معلومات الموقع غير متوفرة.";
      break;
    case error.TIMEOUT:
      errorMessage = "انتهت مهلة طلب تحديد الموقع.";
      break;
  }
  showError(errorMessage);
}

// Get prayer times using coordinates and timezone
function getPrayerTimes(lat, lng) {
  // Use Aladhan API for prayer times
  const date = new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  fetch(
    `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lng}&method=2`
  )
    .then((response) => response.json())
    .then((data) => {
      const today = date.getDate();
      const prayerData = data.data[today - 1].timings;

      // Display prayer times
      displayPrayerTimes(prayerData);

      // Calculate last third of night
      calculateLastThirdOfNight(prayerData);
    })
    .catch((error) => {
      showError("خطأ في جلب أوقات الصلاة: " + error.message);
    });
}

// Display prayer times in the UI
function displayPrayerTimes(prayerData) {
  const prayerTimesDiv = document.getElementById("prayer-times");

  // Format content for display
  let content = "<h2>أوقات الصلاة اليوم</h2>";

  // Main five prayers with Arabic names
  const prayers = [
    { name: "الفجر", key: "Fajr" },
    { name: "الظهر", key: "Dhuhr" },
    { name: "العصر", key: "Asr" },
    { name: "المغرب", key: "Maghrib" },
    { name: "العشاء", key: "Isha" },
  ];

  prayers.forEach((prayer) => {
    // Extract the time part without the timezone
    const timeString = prayerData[prayer.key].replace(" (EET)", "");
    // Convert to Date object then format to 12-hour
    const timeDate = convertPrayerTimeToDate(timeString);
    const formattedTime = formatTime(timeDate);

    content += `
<div class="prayer-time">
<span class="prayer-name">${prayer.name}</span>
<span>${formattedTime}</span>
</div>
`;
  });

  prayerTimesDiv.innerHTML = content;
}

// Calculate the last third of night
function calculateLastThirdOfNight(prayerData) {
  const lastThirdDiv = document.getElementById("last-third");

  // Extract Maghrib and Fajr times
  const maghribTime = convertPrayerTimeToDate(prayerData.Maghrib);
  let fajrTime = convertPrayerTimeToDate(prayerData.Fajr);

  // If Fajr is before Maghrib, it means it's for the next day
  if (fajrTime < maghribTime) {
    fajrTime.setDate(fajrTime.getDate() + 1);
  }

  // Calculate the night duration in milliseconds
  const nightDuration = fajrTime - maghribTime;

  // Calculate the start of the last third
  const lastThirdStart = new Date(
    maghribTime.getTime() + (nightDuration * 2) / 3
  );

  // Get current time
  const now = new Date();

  // Calculate time until last third starts (if it hasn't started yet)
  let content = "";
  if (now < lastThirdStart) {
    // Last third hasn't started yet
    const timeUntilLastThird = formatTimeDifference(lastThirdStart - now);
    content = `
              <h2>الثلث الأخير من الليل</h2>
              <p>يبدأ الثلث الأخير من الليل في <span class="highlight">${formatTime(
                lastThirdStart
              )}</span></p>
              <p>الوقت المتبقي حتى بداية الثلث الأخير: <span class="highlight">${timeUntilLastThird}</span></p>
          `;
  } else if (now < fajrTime) {
    // Currently in the last third of night
    const remainingTime = formatTimeDifference(fajrTime - now);
    content = `
              <h2>الثلث الأخير من الليل</h2>
              <p class="highlight">أنت الآن في وقت الثلث الأخير من الليل!</p>
              <p>بدأ الثلث الأخير في <span class="highlight">${formatTime(
                lastThirdStart
              )}</span></p>
              <p>الوقت المتبقي في الثلث الأخير: <span class="highlight">${remainingTime}</span></p>
          `;
  } else {
    // Past Fajr, calculate for the next night
    content = `
              <h2>الثلث الأخير من الليل</h2>
              <p>لقد مر وقت صلاة الفجر لهذا اليوم.</p>
              <p>سيبدأ الثلث الأخير من الليل في <span class="highlight">${formatTime(
                lastThirdStart
              )}</span> الليلة.</p>
          `;
  }

  // Add interval information
  const intervalStart = formatTime(lastThirdStart);
  const intervalEnd = formatTime(fajrTime);
  content += `
          <div class="info-section">
              <p>فترة الثلث الأخير من الليل: <br>
              <span class="highlight">${intervalStart} - ${intervalEnd}</span></p>
          </div>
      `;

  lastThirdDiv.innerHTML = content;
}

// Helper function to convert prayer time string to Date object
function convertPrayerTimeToDate(timeString) {
  // Remove timezone indicator if present
  timeString = timeString.replace(/ \(.+\)$/, "");

  const today = new Date();
  const [hours, minutes] = timeString.split(":");

  const date = new Date();
  date.setHours(parseInt(hours, 10));
  date.setMinutes(parseInt(minutes, 10));
  date.setSeconds(0);

  return date;
}

// Format time for display
function formatTime(date) {
  return date.toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Format time difference in hours and minutes
function formatTimeDifference(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor(
    (milliseconds % (1000 * 60 * 60)) / (1000 * 60)
  );

  return `${hours} ساعة و ${minutes} دقيقة`;
}

// Show error message
function showError(message) {
  document.getElementById(
    "prayer-times"
  ).innerHTML = `<div class="error">${message}</div>`;
  document.getElementById(
    "last-third"
  ).innerHTML = `<div class="error">تعذر الحساب</div>`;
}

// Initialize the app when the page loads
window.onload = initApp;
