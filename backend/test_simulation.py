import unittest
from datetime import datetime, timezone
import sys
import os

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.physics import (
    calculate_thermal_demand_kw,
    calculate_total_power_demand_kw,
    calculate_fuel_consumption_lph,
    calculate_autonomy_days,
    calculate_overall_risk_score,
)
from app.simulator import engine
from app.config import StationID
from app.models.risk import ComponentStatus

class TestPhysics(unittest.TestCase):
    def test_thermal_demand(self):
        # Q_heat = 0.01 * (21 - T_ambient) * (1 + 0.02 * wind_speed)
        q = calculate_thermal_demand_kw(temperature_c=-10, wind_speed_ms=10)
        # 0.01 * (21 - -10) * (1 + 0.2) = 0.01 * 31 * 1.2 = 0.31 * 1.2 = 0.372
        self.assertAlmostEqual(q, 0.372, places=3)
        
        # extremely low temperature and extreme wind edge case
        q_extreme = calculate_thermal_demand_kw(temperature_c=-80, wind_speed_ms=100)
        # 0.01 * (101) * (1 + 2) = 1.01 * 3 = 3.03
        self.assertAlmostEqual(q_extreme, 3.03, places=3)
        
    def test_power_calculation(self):
        # P_total = 15 + Q_heat + 10 + 5
        p = calculate_total_power_demand_kw(q_heat=2.0)
        self.assertEqual(p, 32.0)
        
    def test_fuel_burn(self):
        # F_rate = P_total * 0.25
        f = calculate_fuel_consumption_lph(32.0)
        self.assertEqual(f, 8.0)
        
    def test_runway_calculation(self):
        # runway = fuel / (F_rate * 24)
        runway = calculate_autonomy_days(192.0, 8.0)
        self.assertEqual(runway, 1.0)
        
        # zero fuel edge case
        runway_zero = calculate_autonomy_days(0.0, 8.0)
        self.assertEqual(runway_zero, 0.0)

    def test_risk_calculation(self):
        # R = 0.35 * fuel + 0.25 * power + 0.25 * struct + 0.15 * env
        # all risks at 100
        r_max = calculate_overall_risk_score(100, 100, 100, 100)
        self.assertAlmostEqual(r_max, 100.0)
        
        # partial risks
        r_partial = calculate_overall_risk_score(50, 0, 10, 20)
        # 17.5 + 0 + 2.5 + 3 = 23
        self.assertAlmostEqual(r_partial, 23.0)

class TestSimulator(unittest.TestCase):
    def setUp(self):
        engine.initialize()
        self.station_id = StationID.MAITRI
        
    def test_simulation_tick_normal(self):
        # tick advances and recalculates state
        initial_state = engine.get_state(self.station_id)
        # advance time slightly
        engine._states[self.station_id].timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc)
        
        new_state = engine.tick(self.station_id)
        self.assertGreaterEqual(new_state.timestamp, initial_state.timestamp)
        
    def test_scenario_polar_vortex(self):
        engine.set_scenario(self.station_id, "polar_vortex")
        state = engine.tick(self.station_id)
        self.assertEqual(state.environment.temperature_c, -55.0)
        
    def test_scenario_katabatic_blizzard(self):
        engine.set_scenario(self.station_id, "katabatic_blizzard")
        state = engine.tick(self.station_id)
        self.assertEqual(state.environment.wind_speed_ms, 46.3)

    def test_scenario_generator_failure(self):
        engine.set_scenario(self.station_id, "generator_failure")
        state = engine.tick(self.station_id)
        self.assertEqual(state.power.generators[0].status, ComponentStatus.OFFLINE)
        self.assertEqual(state.power.generators[0].output_kw, 0.0)
        
    def test_scenario_satcom_blackout(self):
        engine.set_scenario(self.station_id, "satcom_blackout")
        state = engine.tick(self.station_id)
        self.assertTrue(state.comms.is_blackout)
        self.assertGreater(state.comms.blackout_duration_s, 0)
        self.assertGreater(state.comms.buffered_packets, 0)

    def test_edge_case_communication_unavailable(self):
        # Ensure that if is_blackout is active, last_contact doesn't advance
        engine.set_scenario(self.station_id, "satcom_blackout")
        state1 = engine.tick(self.station_id)
        last_contact1 = state1.comms.last_contact
        
        state2 = engine.tick(self.station_id)
        last_contact2 = state2.comms.last_contact
        self.assertEqual(last_contact1, last_contact2)

if __name__ == '__main__':
    unittest.main()
