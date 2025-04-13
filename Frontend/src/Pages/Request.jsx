import { useState, useEffect } from "react";
import "../assets/calender.css";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import Footer from "../Component/Footer";

const option = [];
for (let i = 0; i < 1440; i += 15) {
  option.push(i);
}

const convertMinutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const amPm = hours < 12 ? "AM" : "PM";
  const formattedHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const formattedMinutes = String(remainingMinutes).padStart(2, "0");
  return `${formattedHours}:${formattedMinutes} ${amPm}`;
};
function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  let month = today.getMonth() + 1;
  let day = today.getDate();

  // Pad month and day with leading zeros if needed
  month = month < 10 ? `0${month}` : month;
  day = day < 10 ? `0${day}` : day;

  return `${year}-${month}-${day}`;
}

const AddEvent = () => {
  const [form, setForm] = useState({
    name: `${localStorage.getItem('name')}`,
    email: `${localStorage.getItem('userEmail')}`,
    mobileno: "",
    eventdescription: "",
    date: "",
    clubname: "",
    requestType: "",
    startTime: 0,
    endTime: 15,
    status: "pending",
  });
  const [bookedSlots, setBookedSlots] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  // Fetch booked slots when date changes
  useEffect(() => {
    if (form.date) {
      fetchBookedSlots(form.date);
    }
  }, [form.date]);

  // Fetch booked slots for a specific date
  const fetchBookedSlots = async (date) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/ticket?date=${date}&status=booked`
      );

      // Convert booked slots to minutes for easy comparison
      const bookedSlotsInMinutes = response.data.map((slot) => ({
        start: convertTimeToMinutes(slot.startTime),
        end: convertTimeToMinutes(slot.endTime)
      }));

      setBookedSlots(bookedSlotsInMinutes);
    } catch (err) {
      console.error("Error fetching booked slots:", err);
    }
  };

  // Convert time string to minutes
  const convertTimeToMinutes = (timeString) => {
    const [time, period] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) {
      hours += 12;
    }
    if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  };

  // Check if a time slot is available
  const isTimeSlotAvailable = (startMinutes, endMinutes) => {
    return !bookedSlots.some((slot) =>
      (startMinutes < slot.end && endMinutes > slot.start)
    );
  };

  // Filter available start times
  const getAvailableStartTimes = () => {
    return option.filter((startMinutes) =>
      isTimeSlotAvailable(startMinutes, startMinutes + 15)
    );
  };

  // Filter available end times based on start time
  const getAvailableEndTimes = (startMinutes) => {
    return option.filter((endMinutes) => {
      if (startMinutes >= endMinutes) return false;
      return isTimeSlotAvailable(startMinutes, endMinutes);
    });
  };

  const handleSave = async () => {
    // Validation
    const validationErrors = [];

    // Name validation
    if (!form.name.trim()) validationErrors.push("Name is required");

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim()) {
      validationErrors.push("Email is required");
    } else if (!emailRegex.test(form.email)) {
      validationErrors.push("Invalid email format");
    }

    // Mobile number validation
    const mobileRegex = /^[0-9]{10}$/;
    if (!form.mobileno.trim()) {
      validationErrors.push("Mobile number is required");
    } else if (!mobileRegex.test(form.mobileno)) {
      validationErrors.push("Mobile number must be 10 digits");
    }

    // Date validation
    if (!form.date) validationErrors.push("Date is required");

    // Event description validation
    if (!form.eventdescription.trim()) validationErrors.push("Event description is required");

    // Request type validation
    if (!form.requestType) validationErrors.push("Request type is required");

    // Club name validation (conditional)
    if (form.requestType === 'club' && form.clubname.trim() === '') {
      validationErrors.push("Club name is required for club booking");
    }

    // File validation
    if (!selectedFile) validationErrors.push("PDF file is required");

    // Time slot validation
    if (!isTimeSlotAvailable(form.startTime, form.endTime)) {
      validationErrors.push("Selected time slot is already booked");
    }

    // Display errors if any
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast.error(error));
      return;
    }

    // Create FormData object to send file and other data
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('email', form.email.toLowerCase());
    formData.append('mobileno', form.mobileno);
    formData.append('eventdescription', form.eventdescription.toLowerCase());
    formData.append('date', form.date);
    if (form.requestType === 'club') {
      formData.append('clubname', form.clubname);
    }
    formData.append('requestType', form.requestType);
    formData.append('startTime', convertMinutesToTime(form.startTime));
    formData.append('endTime', convertMinutesToTime(form.endTime));
    formData.append('file', selectedFile);
    console.log("hello");
    for (let pair of formData.entries()) {
      console.log(pair[0] + ': ' + pair[1]);
    }    
    
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/createticket`,
        formData
      );
      // Show success toast
      toast.success("Booking Request sent successfully!");

      // Reset form to initial state
      setForm({
        name: "",
        email: "",
        mobileno: "",
        eventdescription: "",
        date: "",
        clubname: "",
        requestType: "",
        startTime: 0,
        endTime: 15,
        status: "pending",
      });

      // Reset file state
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';

      // Reset any radio buttons
      const radioInputs = document.querySelectorAll('input[type="radio"]');
      radioInputs.forEach(input => {
        input.checked = false;
      });

      // Optional: Scroll to top of form
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

    } catch (err) {
      console.error("Error Details:", {
        status: err.response?.status,
        data: err.response?.data,
        headers: err.response?.headers,
        message: err.message
      });

      const errorMessage = err.response?.data?.message ||
        err.response?.data?.error ||
        "Booking Request failed!";

      toast.error(errorMessage);
    }
  };

  return (
    <>
      <div>
        <Toaster />
      </div>

      <div className="min-h-[85vh] flex flex-col justify-center items-center mx-4 max-sm:mt-5">
        <div className="bg-slate-300 rounded-lg h-auto p-5 flex flex-col shadow-xl w-auto">
          <h1 className="flex justify-center mb-3 font-semibold">
            Register Your Event
          </h1>
          <div className="flex flex-row flex-wrap gap-5">
            <div className="flex flex-col">
              <form action="" method="post">
                <div className="flex flex-row  justify-between my-3 gap-7">
                  <label className="font-semibold">Name</label>
                  <input
                    className="rounded-[5px] w-[200px] outline-none pl-2"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                    }}
                  />
                </div>
                <div className="flex flex-row justify-between my-3 gap-7 w-[350px]">
                  <label className="font-semibold">Email</label>
                  <input
                    className="rounded-[5px] w-[200px] outline-none pl-2"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                    }}
                  />
                </div>
                <div className="flex flex-row justify-between my-3 gap-7 w-[350px]">
                  <label className="font-semibold">Mobile Number</label>
                  <input
                    className="rounded-[5px] w-[200px] outline-none pl-2"
                    type="text"
                    required
                    min={getCurrentDate()}
                    value={form.mobileno}
                    onChange={(e) => {
                      setForm({ ...form, mobileno: e.target.value });
                    }}
                  />
                </div>
                <div className="flex flex-row justify-between my-3 gap-7 w-[350px]">
                  <label className="font-semibold">Date</label>
                  <input
                    className="rounded-[5px] w-[200px] outline-none pl-2"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => {
                      setForm({ ...form, date: e.target.value });
                    }}
                  />
                </div>
                {/* <div className="flex flex-row justify-between my-3 gap-7 w-[350px]">
                  <label className="font-semibold">Clubname</label>
                  <input
                    className="rounded-[5px] w-[200px] outline-none pl-2"
                    type="text"
                    required
                    value={form.clubname}
                    onChange={(e) => {
                      setForm({ ...form, clubname: e.target.value });
                    }}
                  />
                </div> */}
                <div className="flex flex-col my-3 gap-2 w-[350px]">
                  <label className="font-semibold">Booking Type</label>
                  <div className="flex flex-row justify-center items-center gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="bookingType"
                        value="club"
                        checked={form.requestType === 'club'}
                        onChange={(e) => setForm({ ...form, requestType: e.target.value })}
                        className="mr-2"
                      />
                      Club
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="bookingType"
                        value="teacher"
                        checked={form.requestType === 'teacher'}
                        onChange={(e) => setForm({ ...form, requestType: e.target.value })}
                        className="mr-2"
                      />
                      Teacher
                    </label>
                  </div>
                </div>
                {form.requestType === 'club' && (
                  <div className="flex flex-row justify-between my-3 gap-7 w-[350px]">
                    <label className="font-semibold">Club Name</label>
                    <input
                      className="rounded-[5px] w-[200px] outline-none pl-2"
                      type="text"
                      placeholder="Enter club name"
                      value={form.clubname}
                      onChange={(e) => {
                        setForm({ ...form, clubname: e.target.value });
                      }}
                    />
                  </div>
                )}
                <div className="flex flex-row justify-between my-3 gap-7 w-[350px]">
                  <label className="font-semibold">PDF</label>
                  <input
                    className="rounded-[5px] w-[200px] outline-none pl-2"
                    type="file"
                    accept=".pdf"
                    required
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file && file.type === 'application/pdf') {
                        setSelectedFile(file);
                      } else {
                        toast.error('Please select a valid PDF file');
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </form>
            </div>

            <div className="flex flex-row justify-between my-3 gap-7 w-[350px]">
              <textarea
                name="Description"
                cols="30"
                required
                rows="4"
                className="rounded-lg p-5 outline-none resize-none h-full w-full"
                placeholder="Enter Description"
                value={form.eventdescription}
                onChange={(e) => {
                  setForm({ ...form, eventdescription: e.target.value });
                }}
              ></textarea>
            </div>
          </div>
          <div className="flex my-4">
            <FormControl sx={{ m: 1, width: 120 }} size="small">
              <InputLabel id="demo-select-small-label">Start</InputLabel>
              <Select
                labelId="demo-select-small-label"
                id="demo-multiple-name"
                value={form.startTime}
                label="time"
                onChange={(e) => {
                  setForm({
                    ...form,
                    startTime: Number(e.target.value),
                    endTime: 15 // Reset end time when start time changes
                  });
                }}
                MenuProps={{
                  PaperProps: {
                    style: {
                      height: 200,
                      width: 120,
                    },
                  },
                }}
              >
                {getAvailableStartTimes().map((val) => (
                  <MenuItem key={val} value={val}>
                    {convertMinutesToTime(val)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ m: 1, width: 120 }} size="small">
              <InputLabel id="demo-select-small-label">End</InputLabel>
              <Select
                labelId="demo-select-small-label"
                id="demo-multiple-name"
                value={form.endTime}
                label="time"
                onChange={(e) => {
                  setForm({ ...form, endTime: Number(e.target.value) });
                }}
                MenuProps={{
                  PaperProps: {
                    style: {
                      height: 200,
                      width: 120,
                    },
                  },
                }}
              >
                {getAvailableEndTimes(form.startTime).map((val) => (
                  <MenuItem key={val} value={val}>
                    {convertMinutesToTime(val)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <button
            className="border-[2px] border-slate-700  w-[200px] hover:bg-slate-400 text-black shadow-lg font-semibold h-[45px]  py-1 px-3 rounded-lg"
            onClick={handleSave}
            type="submit"
          >
            Send Request
          </button>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default AddEvent;
