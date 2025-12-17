const { getDevices, createHourlyPin } = require("./services/iglooAccess");

async function run() {
  try {
    console.log("🔍 Načítám zařízení...");
    const list = await getDevices();
    const device = list.payload[0];

    console.log("🔐 Používám deviceId:", device.deviceId);

    const start = new Date();               // teď
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // +4 hodiny

    const pin = await createHourlyPin({
      deviceId: device.deviceId,
      startDate: start,
      endDate: end,
      accessName: "Zápůjčka"
    });

    console.log("✅ HOURLY PIN vytvořen:");
    console.log(pin);

  } catch (err) {
    console.error("❌ Test se nepovedl:", err.message);
  }
}

run();
