import './ScrollingCountries.css';

const COUNTRIES = [
  "France", "Japan", "Brazil", "Canada", "India", 
  "Germany", "Australia", "Italy", "Spain", "Mexico",
  "South Africa", "Thailand", "Greece", "Vietnam", "Portugal",
  "Morocco", "Turkey", "Peru", "Norway", "Ireland",
  "Sweden", "Denmark", "Finland", "Netherlands", "Switzerland",
  "New Zealand", "Argentina", "Chile", "Costa Rica", "Kenya"
];

function ScrollingCountries() {
  const countriesList = [...COUNTRIES, ...COUNTRIES];
  
  return (
    <div className="scrolling-footer">
      <div className="scroll-line scroll-line--top">
        <div className="scroll-track scroll-track--left">
          {countriesList.map((country, i) => (
            <span key={`top-${i}`} className="scroll-text scroll-text--small">
              {country}
            </span>
          ))}
        </div>
      </div>

      <div className="scroll-line scroll-line--middle">
        <div className="scroll-track scroll-track--right">
          {countriesList.map((country, i) => (
            <span key={`middle-${i}`} className="scroll-text scroll-text--medium">
              {country}
            </span>
          ))}
        </div>
      </div>

      <div className="scroll-line scroll-line--bottom">
        <div className="scroll-track scroll-track--left">
          {countriesList.map((country, i) => (
            <span key={`bottom-${i}`} className="scroll-text scroll-text--large">
              {country}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScrollingCountries;