import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
function App() {
  const [menus, setMenus] = useState([]);

useEffect(() => {
  const fetchMenus = async () => {
    const querySnapshot = await getDocs(collection(db, "menus"));

    const menuData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setMenus(menuData);
  };

  fetchMenus();
}, []);
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>🍗 LK Fried Chicken</h1>

      <h2>เมนูแนะนำ</h2>
{menus.map((menu) => (
  <div
    key={menu.id}
    style={{
      border: "1px solid #ddd",
      padding: "10px",
      marginBottom: "10px",
    }}
  >
    <h3>{menu.name}</h3>
    <p>ราคา {menu.price} บาท</p>

    {menu.image && (
      <img
        src={menu.image}
        alt={menu.name}
        width="150"
      />
    )}
  </div>
))}
      

      <button>สั่งอาหาร</button>
    </div>
  );
}

export default App;