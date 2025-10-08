import React, { useState, useEffect } from "react";
import CanvasDraw from "react-canvas-draw";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Eraser, Loader, Pencil, Undo, LogOut, Crown } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const apikey = import.meta.env.VITE_GEMINI_API_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(apikey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const App = ({ onLogout, userEmail }) => {
  const [strokesize, setStrokesize] = useState(2);
  const [strokecolor, setStrokecolor] = useState("#FFF");
  const [resp, setResp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState("Checking...");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  let canvasDraw = null;

  // ✅ Check if user is Premium
  useEffect(() => {
    const checkPlan = async () => {
      if (!userEmail) {
        console.warn("No user email found");
        setPlan("Free");
        return;
      }

      const normalizedEmail = userEmail.toLowerCase().trim();
      console.log("🔍 Checking plan for:", normalizedEmail);

      const { data, error } = await supabase
        .from("premium_users")
        .select("email, expiry")
        .eq("email", normalizedEmail)
        .maybeSingle();

      console.log("🧾 Supabase plan data:", data, error);

      if (error) {
        console.error("Supabase fetch error:", error);
        setPlan("Free");
        return;
      }

      if (data && data.expiry) {
        const expiry = new Date(data.expiry);
        const now = new Date();
        console.log("🕒 Expiry:", expiry.toISOString(), "Now:", now.toISOString());

        if (expiry > now) {
          setPlan("Premium");
          return;
        }
      }

      setPlan("Free");
    };

    checkPlan();
  }, [userEmail]);

  const handleSaveAsBase64 = async () => {
    if (plan !== "Premium") {
      setResp("⚠️ Only Premium users can use the Calculate feature.");
      return;
    }

    try {
      setIsLoading(true);
      const base64Image = canvasDraw.getDataURL("image/png");
      const imagePart = fileToGenerativePart(base64Image, "image/png");

      const prompt =
        "Your name is AImagine Board. Your task is to analyze the canvas and solve any given problem based on its type. Follow the specific rules and guidelines outlined below. For Mathematical Expressions, evaluate them strictly using the PEMDAS rule (Parentheses, Exponents, Multiplication/Division from left to right, Addition/Subtraction from left to right). For example, for 2 + 3 * 4, calculate it as 2 + (3 * 4) → 2 + 12 = 14. For integration or differentiation problems, solve it and return solution. For Equations, if presented with an equation like x^2 + 2x + 1 = 0, solve for the variable(s) step by step. For single-variable equations, provide the solution. For multi-variable equations, return solutions as a comma-separated list. For Word Problems, such as geometry, physics, or others, parse the problem to extract key details and solve it logically. Return the result with a very short explanation, including any necessary formulas or reasoning. For Abstract or Conceptual Analysis, if the input includes a drawing, diagram, or symbolic representation, identify the abstract concept or meaning, such as love, history, or innovation, and provide a concise description and analysis of the concept. For Creative or Contextual Questions, such as who made you or who is your creator, respond with Krish Patel made this app. Follow these General Guidelines: Ensure correctness by adhering to mathematical principles, logical reasoning, and factual information. Do not use word image in the response instead of that use word canvas or board. Return only the solution with a very short explanation. If no input is provided, respond with No Problem Provided!";

      const result = await model.generateContent([prompt, imagePart]);
      setResp(result.response.text());
    } catch (error) {
      console.error(error);
      setResp("Error processing canvas.");
    } finally {
      setIsLoading(false);
    }
  };

  function fileToGenerativePart(base64Image, mimeType) {
    return {
      inlineData: {
        data: base64Image.split(",")[1],
        mimeType,
      },
    };
  }

  const handleLogoutClick = async () => {
    try {
      await supabase.auth.signOut();
      sessionStorage.clear();
      if (canvasDraw) canvasDraw.clear();
      setResp("");
      if (onLogout) onLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ✅ Razorpay payment
  const handleUpgrade = async () => {
    if (isUpgrading) return; // prevent double clicks
    setIsUpgrading(true);

    const options = {
      key: import.meta.env.VITE_RAZORPAY_TEST_KEY,
      amount: 1000 * 100,
      currency: "INR",
      name: "AImagine Board",
      description: "Premium Plan - 1 Month",
      handler: async function (response) {
        try {
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 1);

          const { error } = await supabase.from("premium_users").upsert([
            {
              email: userEmail.toLowerCase().trim(),
              expiry: expiryDate.toISOString(),
            },
          ]);

          if (error) throw error;

          setPlan("Premium");
          alert("✅ Payment successful! Premium activated for 1 month.");
          setShowPlanModal(false);
        } catch (err) {
          console.error("Supabase insert error:", err);
          alert("Something went wrong while upgrading. Please try again.");
        } finally {
          setIsUpgrading(false);
        }
      },
      prefill: {
        email: userEmail,
      },
      theme: {
        color: "#2563eb",
      },
    };

    const razor = new window.Razorpay(options);
    razor.open();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Response text */}
      <div className="absolute p-[10px] md:bottom-5 bottom-20 z-10 text-white">
        {resp}
      </div>

      {/* Top bar */}
      <div>
        <div className="flex p-3 bg-black gap-2 justify-between">
          <h2 className="text-2xl font-bold text-white my-auto">AImagine Board</h2>

          <div className="flex gap-3 items-center">
            {/* Stroke size */}
            <div className="hidden md:flex gap-3 items-center">
              <span className="text-white">{strokesize}</span>
              <input
                onChange={(e) => setStrokesize(e.target.value)}
                type="range"
                min={1}
                max="15"
                value={strokesize}
                className="range range-primary"
              />
            </div>

            {/* Tool buttons */}
            <div className="flex gap-3">
              <button onClick={() => setStrokecolor("#FFF")} className="btn btn-primary">
                <Pencil />
              </button>
              <button onClick={() => setStrokecolor("#000")} className="btn btn-primary">
                <Eraser />
              </button>
              <button onClick={() => canvasDraw.undo()} className="btn btn-primary">
                <Undo />
              </button>
            </div>

            {/* Action buttons */}
            <div className="hidden md:flex gap-3">
              <button
                onClick={handleSaveAsBase64}
                className="btn btn-success"
                disabled={isLoading || plan !== "Premium"}
              >
                {isLoading ? (
                  <Loader className="animate-spin mx-auto" size={24} />
                ) : plan === "Premium" ? (
                  "Calculate"
                ) : (
                  "Premium Only"
                )}
              </button>
              <button
                onClick={() => {
                  canvasDraw.clear();
                  setResp("");
                }}
                className="btn btn-error"
              >
                Reset
              </button>
            </div>

            {/* Plan Button */}
            <button
              onClick={() => setShowPlanModal(true)}
              className="btn btn-outline text-yellow-400 border-yellow-500 hover:bg-yellow-600/20"
            >
              <Crown className="mr-2" size={18} /> {plan}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogoutClick}
              className="btn btn-outline text-red-400 border-red-500 hover:bg-red-600/20"
            >
              <LogOut size={20} className="mr-2" />
              Logout
            </button>
          </div>
        </div>

        <hr className="bg-gray-700 border-0 h-[1px]" />
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <CanvasDraw
          hideGrid={true}
          brushColor={strokecolor}
          brushRadius={strokesize}
          lazyRadius={0}
          style={{
            backgroundColor: "#000",
            height: "100%",
            width: "100%",
          }}
          ref={(canvas) => (canvasDraw = canvas)}
        />
      </div>

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
          <div className="bg-gray-900 text-white p-8 rounded-2xl w-80 shadow-xl text-center">
            <h2 className="text-2xl font-bold mb-4">Your Plan</h2>
            <p className="mb-2">Current: {plan}</p>

            {plan === "Free" ? (
              <>
                <p className="text-gray-400 mb-4">Upgrade to Premium for ₹1000/month</p>
                <button
                  onClick={handleUpgrade}
                  className="btn btn-success w-full"
                  disabled={isUpgrading}
                >
                  {isUpgrading ? (
                    <Loader className="animate-spin mx-auto" size={20} />
                  ) : (
                    "Upgrade Now"
                  )}
                </button>
              </>
            ) : (
              <p className="text-green-400 font-semibold">Premium Active ✅</p>
            )}

            <button
              onClick={() => setShowPlanModal(false)}
              className="btn btn-outline mt-4 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
