import { motion } from 'motion/react';
import checkIcon from '../assets/check-empty.svg';

export function EmptyState() {
  return (
    <motion.div
      className="empty"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="empty-illustration">
        <img src={checkIcon} width={32} height={32} alt="" />
      </div>
      <p className="t-habit-name">No habits yet</p>
      <p className="t-body empty-body">
        Add one small thing you want to do every day. Tap it once a day to keep the streak going.
      </p>
    </motion.div>
  );
}
